# Code Review — `HEAD~4..HEAD`

Range: commits `8874a94..74634ed` ("Add credential auth; fix transport, payload & tests" → "0.1.4").
Effort: high / recall-biased. Findings ranked most-severe first.

## Correctness / behavior

### 1. Selecting an expand-gated field in "Selected Fields" update mode throws instead of patching — CONFIRMED
`nodes/NkscIvanti/actions/securityReport/update.operation.ts:165`

The scope/loss expansion toggles (`ScopeOption*`, `LossOption*`, `reportFields.ts:42`) are payload
fields with `visibleWhen: {ScopeOptionsExpanded:[true]}`, and they appear in the *Fields To Update*
dropdown. If a user selects one and provides a value but leaves `ScopeOptionsExpanded` at its default
`false` (or toggled it on, set the value, then collapsed — n8n keeps hidden values), `isFieldApplicable`
(`payload.ts:275`) filters it out, `body` ends up empty, and the node throws *"At least one selected
field must have a value to update"* even though the user selected and valued the field.

### 2. Search now silently truncates to 10 results by default — PLAUSIBLE
`nodes/NkscIvanti/actions/securityReport/search.operation.ts:16`

`defaultSearchLimit = 10` and the query always sends `$top: searchLimit`. An external ticket ID mapping
to >10 Ivanti reports now returns only the first 10 with no truncation signal. Downstream logic that
assumed a complete set (dedup, "find latest", reconciliation) silently operates on a partial set. If the
README still says the node "returns them all," that's now a doc/behavior mismatch.

### 3. `parseIvantiResponse` leaks the transport envelope when the body is empty — PLAUSIBLE
`nodes/NkscIvanti/transports/index.ts:118`

`return response?.body ?? response;` — for a 200 (non-204) response with an empty/absent JSON body,
`response.body` is `undefined`, so the whole `FullHttpResponse` (`{statusCode, headers, body}`) is
returned and spread into the item JSON. Only 204 is special-cased. Should return `{}` for any empty
successful body.

### 4. Explicit timezone offset is captured then discarded, shifting absolute timestamps — PLAUSIBLE
`nodes/NkscIvanti/actions/securityReport/payload.ts:339`

The regex captures `(Z|[+-]\d{2}:?\d{2})` but line 347 rebuilds the string without it. An input carrying
a real offset — e.g. `2026-04-29T14:30:12Z`, which is what an n8n dateTime/webhook value often looks
like — is reinterpreted as Europe/Vilnius wall-clock, shifting the stored instant by 2–3h. The code
comment says stripping is intentional for *bare* local strings, but for an offset-bearing (absolute)
input this produces the wrong instant; at minimum the captured group is dead code signalling intent that
was never wired up.

### 5. Valid wall-clock times in the DST spring-forward gap are rejected — CONFIRMED
`nodes/NkscIvanti/actions/securityReport/payload.ts:300`

The round-trip check `localDateTime.toFormat(...) !== localWallClockValue` throws *"… must be a valid
date/time"* for the nonexistent Vilnius hour (last Sunday of March, `03:00–03:59`), because Luxon shifts
the nonexistent time forward so it no longer round-trips. A user submitting e.g. `2026-03-29T03:30:00`
gets a spurious rejection. Rare (one hour/year) but a real false negative the old UTC-based path never
produced.

### 6. Conditional-required validation was narrowed; a covering test was deleted — PLAUSIBLE
`nodes/NkscIvanti/actions/securityReport/payload.ts:186`

The removed `isConditionalRuleActiveOrPending` also fired a rule when its controller field was itself
required-and-empty; the replacement `if (payload[rule.when] !== rule.is) continue;` only fires on the
exact trigger value. In the current forms the empty controller is still flagged, so no bad payload leaks
*today* — but a future chain whose intermediate controller is optional will skip validating downstream
required fields, and multi-error UX degraded (users now fix the controller, resubmit, then discover the
next requirement). The deleted test "recursively reports conditional fields behind missing conditional
inputs" confirms this coverage was intentional.

## Altitude / reuse / efficiency

### 7. Auth header is set in two places — CONFIRMED
`nodes/NkscIvanti/transports/index.ts:84`

`buildHttpRequestOptions` hand-sets `Authorization: rest_api_key=${apiKey}`, but the credential's new
`authenticate` block (`credentials/NkscIvantiApi.credentials.ts:44`) injects the identical header through
`httpRequestWithAuthentication`. Two sources of truth for the same header — harmless today, but any change
to the key format/scheme must be edited in both, and divergence produces hard-to-trace 401s. Drop the
manual header now that `authenticate` exists.

### 8. "Fields To Update" numeric tokens resolve positionally with no stable key — CONFIRMED
`nodes/NkscIvanti/actions/securityReport/update.operation.ts:267`

`resolveFieldSelectionToken` maps a numeric token to `fields[n-1]`, and `getNumberFromToken` (`:286`)
extracts the leading number from `'3. Summary'` and **ignores the label text** — so if the label and
number ever disagree (a stale expression after fields are reordered/inserted in
`reportFormDefinitions.ts`), it silently patches a different Ivanti column with no error. This is a
fragile positional API layered over stable field names; matching by field/payload name only would be the
deeper fix.

### 9. `getErrorMessage` and the per-item catch block are copy-pasted across all three operations — CONFIRMED
`nodes/NkscIvanti/actions/securityReport/insert.operation.ts:60` & `:134`

The identical `getErrorMessage` helper (insert `:134`, search `:128`, update `:294`) and the identical
~9-line `catch` (continueOnFail paired-item return + `NodeOperationError`/`NodeApiError` rethrow + wrap)
exist verbatim in insert/search/update. A change to per-item error handling must touch three sites and
will drift; extract a shared `handleOperationError`/`getErrorMessage`.

### 10. The `while (changed)` required-fields loop now always runs a wasted no-op pass — CONFIRMED
`nodes/NkscIvanti/actions/securityReport/payload.ts:181`

Since rule activation depends only on the static `payload` and `payload` never mutates inside the loop,
once any conditional rule fires `changed` flips true and forces a full second pass that re-evaluates
every rule and rebuilds every message string (each an O(fields) `.find`) only to add nothing and exit.
The fixpoint loop is dead machinery after the pending-rule logic was removed — a single pass suffices.

## Refuted / dropped

- **`getNumberFromToken('7. Summary')` returning the wrong field** — self-consistent labels resolve
  correctly; only stale/hand-written labels drift (covered by #8).
- **Date-only inputs shifting the calendar day** — round-trips correctly via Ivanti's offset re-add,
  which is the documented design.
- **Removed router-level `try/catch`** — per-item errors are already wrapped in each operation's
  `executeItem`, and n8n's harness wraps the rest.
- **Non-string error `description`/`message` being dropped** — the raw error body is still attached to
  the `NodeApiError`, so detail isn't lost.
