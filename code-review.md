# Code Review — 2026-05-27

Package: `@syn-con/n8n-nodes-nksc-ivanti` v0.1.2
Scope reviewed: `nodes/`, `credentials/`, `index.ts`, `tests/`, build/config, `package.json`, `README.md`.
Method: parallel multi-agent review across DRY, SRP, TypeScript, test coverage, dead code, security, bugs, best practices, n8n documentation compliance, and comments/documentation. `npm audit` and `npm run lint` executed.

---

## Executive summary

The codebase is well-structured and in good shape: strict TypeScript with no `any`, clean layering (node → router → operations → payload/transport), idiomatic n8n patterns, and high test coverage (67 tests, ~98% statements). `npm run lint` passes with 0 warnings; `tsc --noEmit` is clean.

The highest-value issues are **two date/time correctness bugs** (hardcoded +3h offset and timezone-offset stripping), an **OData path-injection vector via `recordId`** (elevated by `usableAsTool: true`), a **router double-wrap** that discards HTTP error context, several **n8n-compliance gaps** (no `authenticate` credential, GitHub Packages registry blocks community-node install, no LICENSE), and a **localization inconsistency** (ASCII-stripped Lithuanian field descriptions).

### Priority fixes (do these first)
1. **BUG-1 / BUG-2** — date/time `+3h` offset is DST-fragile and silently strips timezone offsets, producing wrong timestamps. *(payload.ts)*
2. **SEC-1** — validate/encode `recordId` before interpolating into the OData URL path. *(update.operation.ts:70)*
3. **N8N-H1** — add `authenticate: IAuthenticateGeneric` to the credential; remove the duplicated manual `Authorization` header.
4. **N8N-H2 / DOC-B6 / MISC-C5** — publishing to GitHub Packages blocks the n8n community-node install flow; add a `LICENSE` file; clarify distribution.
5. **BUG-5 / N8N-M3** — stop double-wrapping errors in `router.ts`; pass `{ itemIndex }` and `pairedItem` to errors.
6. **TEST** — add tests for `maxLength` enforcement and the `validateRequiredFields: true` update path.

---

## 1. Security

> `npm audit --omit=dev` → **0 vulnerabilities**. All 42 advisories (28 moderate / 7 high / 7 critical) are in **devDependencies** (`n8n-core`, `n8n-workflow`, `@n8n/node-cli`, `eslint-plugin-n8n-nodes-base`) and peer deps. The published package ships only `dist/` with **no runtime dependencies**, so consumers are not exposed. No action strictly required; the dev-time advisories can be reduced with `npm audit fix` if desired.

### SEC-1 — OData URL path injection via unvalidated `recordId` — **High**
`nodes/NkscIvanti/actions/securityReport/update.operation.ts:70`
`recordId` is interpolated directly into the OData URL path with no validation/encoding:
```ts
endpoint: `/odata/businessobject/${form.objectName}('${recordId}')`,
```
A crafted value (`ABC') or 1 eq 1 or ('`, or `../../odata/users`) can malform the path or redirect to an unintended resource. The `externalTicketId` filter is correctly escaped, but `recordId` is not. **Elevated because `usableAsTool: true` (`NkscIvanti.node.ts:32`)** gives an LLM agent direct control of this parameter (prompt-injection surface).
**Fix:** validate against the Ivanti RecId format before use:
```ts
if (!/^[0-9A-Fa-f]{32}$/.test(recordId.trim())) {
  throw new NodeOperationError(this.getNode(), 'Record ID must be a 32-character hex string');
}
```
At minimum, percent-encode the segment.

### SEC-2 — HTTP downgrade / SSRF-adjacent credential config — **Medium**
`transports/index.ts:80-83`, `credentials/NkscIvantiApi.credentials.ts:18`
`buildApiBaseUrl` preserves `http://` URLs and there is no host validation (private/loopback/link-local `169.254.169.254`). In a shared n8n install, a user could point `tenant` at internal infrastructure and exfiltrate responses, or send the API key in cleartext over HTTP.
**Fix:** document that `http://` is dev-only; warn in the credential UI that HTTP exposes the key in transit; optionally block private ranges / enforce HTTPS for production.

### SEC-3 — API key not sanitized before header injection — **Low**
`transports/index.ts:41`
`Authorization: rest_api_key=${credential.apiKey}` — if the key contained `\r`/`\n` it could enable HTTP header injection. Ivanti keys are opaque tokens in practice, but no assertion exists.
**Fix:** strip/reject CR/LF in the key when building the header.

### SEC-4 — Router error-wrapping (see also BUG-5) — **Low**
`actions/router.ts:21-23` re-wraps already-typed errors. No credential/raw-API leak (transport already separates the Ivanti error body from request headers), but HTTP status context is lost. Fix covered in BUG-5.

### Done well
- Credentials fetched via `this.getCredentials()` (n8n vault), never hardcoded.
- API key never appears in any error message, log, or URL — only the outbound `Authorization` header.
- OData `$filter` for `externalTicketId` is correctly escaped (single-quote doubling — correct OData v4 rule).
- `Promise.all` over items uses per-item `itemIndex`; no shared-state race.
- `applySelectedOptions` silently ignores unknown `multiOptions` values (safe against injection via that path).

---

## 2. Bugs / correctness

### BUG-1 — Future-date check runs on the already-shifted value (allows up to 3h in the future) — **High**
`payload.ts:244-249`
The −3h offset is applied *before* the future check, so a timestamp up to 3h ahead of `now` (UTC) passes. E.g. `now = 18:00 UTC`, input `20:00 UTC` → shifted `17:00 < 18:00` passes, and `17:00 UTC` (= `20:00 +03:00`, a future event) is sent to Ivanti.
**Fix:** validate `parsedDateTime` against `now` *before* subtracting the offset.

### BUG-2 — `getExactDateTimeFromString` silently strips timezone offsets — **High**
`payload.ts:273-286`
The regex accepts an optional offset (`Z|[+-]\d{2}:?\d{2}`) but captures only wall-clock parts and discards the offset; the result is then parsed as UTC. Input `2026-04-29T14:30:12+05:30` is treated as `14:30:12 UTC` (wrong), then −3h. Tests pass only because the n8n date picker always emits `+03:00`, matching the hardcoded bias. Any other offset → silently wrong timestamp.
**Fix:** parse the raw, timezone-aware value with `tryToParseDateTime(value, 'UTC').toUTC()` instead of stripping the offset. See also COMMENT-A1 (the `=3` is DST-fragile: Lithuania is UTC+3 only in summer, UTC+2 in winter — prefer an IANA zone `Europe/Vilnius`).

### BUG-3 — Conditional rule fires spurious errors for a required-but-empty control — **Medium**
`payload.ts:171-181`
When a control field (e.g. `CyberIncidentReputationYesNo`) is required but empty, `isConditionalRuleActiveOrPending` treats the rule as "pending" and also requires its dependent (`CyberIncidentReputationValue`), producing a misleading second error ("Details is required" when the user simply hasn't answered Yes/No yet).
**Fix:** drop the "pending" branch — fire only when `payload[rule.when] === rule.is`. The parent's own required check already covers the missing-parent case. *(Note: this interacts with TEST gaps and is partly intentional design — confirm desired UX before changing.)*

### BUG-4 — `sanitizeResponse` mutates its input object — **Medium**
`insert.operation.ts:122-130`
`delete responseData['@odata.context']` mutates the caller-owned response (and again per-record in `extractODataRecords`). Currently harmless but violates immutability and makes tests fragile.
**Fix:** return a new object via destructuring rest: `const { '@odata.context': _omit, ...rest } = ...; return rest;`

### BUG-5 — `router.ts` double-wraps errors, losing HTTP status context — **Medium**
`actions/router.ts:9-24` (+ each operation's catch)
Operations already throw `NodeOperationError`/`NodeApiError`; the router wraps them again, flattening `NodeApiError` HTTP context (`httpCode`, `description`) into a generic error.
**Fix:** remove the router try/catch (let typed errors propagate); only wrap genuinely unknown errors. Combine with N8N-M3 (`itemIndex`/`pairedItem`).

### BUG-6 — Duplicate `externalTicketId` field definition — **Low**
`search.operation.ts:18-25` vs `reportFields.ts:121-128`
Search defines its own field (param name `externalTicketId`) separate from the base field (`XSC_ExternalTicket_RecId`). Works today, but dual naming is a refactor hazard.

### BUG-7 — Non-string `recordId` passes the truthiness guard — **Low**
`update.operation.ts:58-61`
`!recordId` lets a numeric expression result (`123`) through and interpolates it as a string. Use `typeof recordId !== 'string' || !recordId.trim()` (becomes important once SEC-1's regex guard is added).

---

## 3. TypeScript

> `tsc --noEmit` passes. No `any`; `strict` on; good use of `as const` + indexed-access unions and `unknown` at boundaries. Findings are about closing remaining `as` escape hatches and tightening types.

### TS-High
- **HTTP response is implicitly `any`** — `transports/index.ts:57-71`. `this.helpers.httpRequest` returns `any`; `statusCode`/`body` accesses are unchecked. Capture as a typed shape `{ statusCode: number; body: unknown }` and narrow.
- **`errorResponse.description?.toString()` on a `JsonObject`** — `transports/index.ts:60-64`. `description`/`message` are `JsonValue` (could be objects → `"[object Object]"`). Narrow with `typeof … === 'string'` instead of asserting + `.toString()`.
- **`credential.tenant as string`** — `transports/index.ts:37,42`. Use the generic `getCredentials<{ tenant: string; apiKey: string }>('nkscIvantiApi')` and drop the cast. (Also: the `credential === undefined` guard at line 33 is dead — the generic overload is non-nullable.)

### TS-Medium
- `getNodeParameter(...) as PayloadValue | string | boolean` across operations (`insert.operation.ts:89,108,109`; `update.operation.ts:58,64`; `search.operation.ts:50,52`) — unvalidated assertions; a wrong-typed expression throws a confusing `TypeError`. Read as `unknown` and coerce/validate the values you call string methods on.
- `field.default as PayloadValue` (`payload.ts:39`, `insert.operation.ts:97`) — unnecessary cast; remove to catch future drift.
- `input[name] as string | boolean` in `isFieldApplicable` (`payload.ts:219`) — drops array/number cases; let `includes` take `PayloadValue`.
- `payload[name] as PayloadValue` in `requireValue`/conditional checks (`payload.ts:347,176,180`) — widen `isEmptyValue` to accept `unknown` to remove the casts.

### TS-Low
- **tsconfig missing high-value strict flags** — `tsconfig.json`. `strict` is on (explicit `noImplicitAny`/`strictNullChecks` are redundant), but adding `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` surfaces **3 real issues** today (verified): `errors[0]` possibly-undefined (`payload.ts:185`), `displayOptions: undefined` assignment (`reportForms.ts:137`), and the `NodeApiError` options object (`transports/index.ts:61`). Also consider `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUnusedParameters`.
- `PayloadValue` includes `number | null` that no input path produces (`payload.ts:10`) — narrowing to `string | boolean | string[] | undefined` removes several casts.
- `ReportField` permits invalid combos (`options` on a string field, `rows` on a boolean) — `reportTypes.ts:24-39`. Consider a discriminated union on `type` (larger refactor; architectural).
- `ConditionalRequiredRule.when`/`require` are raw `string` (`reportTypes.ts:41-47`) — a typo silently disables a validation rule. Type against a union of real field names derived from `as const`.
- `reportForms[formId as ReportFormId]` cast then `if (!form)` guard (`reportForms.ts:86-92`) — the cast contradicts the runtime check; `noUncheckedIndexedAccess` would make it honest.
- `(error as Error).message` in catch blocks (operations + `router.ts:22` + `transports/index.ts:73`) — caught values are `unknown`; add a `toError(e)` helper.

### Exemplary
`reportOptions.ts` (`inputToString(unknown)`, `NumberedOption`, `as const`, optional-spread) and `node.type.ts`/`index.ts`/credential class are clean.

---

## 4. Test coverage

> `npm test` → 67 tests pass. v8 coverage runs: **98.62% stmts / 93.3% branch / 98.3% funcs**. Note: `vitest.config.ts` coverage key is misspelled `reports` (should be `reporter`), so the configured reporter selection is ignored (falls back to defaults). `update.operation.ts` and `search.operation.ts` sit at exactly the 80% branch threshold.

| File | %Stmt | %Branch | Uncovered |
|---|---|---|---|
| NkscIvanti.node.ts | 96.29 | 100 | 68-69 (`execute`) |
| insert.operation.ts | 100 | 95.65 | 123 |
| payload.ts | 94.48 | 90.82 | 330-335, 366-367 |
| reportForms.ts | 100 | 96.15 | 103-105 |
| reportOptions.ts | 100 | 97.43 | 282 |
| search.operation.ts | 94.02 | 80 | 76-77, 96-97 |
| update.operation.ts | 96.82 | 80 | 84-85 |
| transports/index.ts | 100 | 93.33 | 71 |

### High-value gaps
- **`maxLength`/`validateFieldLengths` entirely untested** — `payload.ts:317-337`. Every text field has a `maxLength` and length validation runs *even when `validateRequiredFields=false`* (the update default). Add: over-length `Summary` (256 chars) throws; length still enforced on the `false` update path; boundary at exactly `maxLength` passes.
- **Update `validateRequiredFields: true` path untested** — `update.operation.ts:63-68`. The only update test passes `false`. Add both: complete payload → PATCH issued; incomplete → throws / error item. This is the entire reason the option exists.
- **Transport error-content preservation untested** — `transport.test.ts:113` only asserts rejection, not that the API `message`/`description` survive. Given the double-wrap (BUG-5), structured error data is likely dropped and the test wouldn't catch it. Add an assertion on the propagated error content.
- **`extractODataRecords` single-object (no `value`) response** — `search.operation.ts:96-97`. Only the array branch is tested.
- **`visibleWhen` gating through `buildReportPayload`** — `payload.ts:52,216-224`. The per-toggle expanded scope/loss path (`field.type==='toggle'` + `visibleWhen`) is never exercised end-to-end; only the multiOptions array path is.

### Medium / Low
- `formatDateTime` edge branches (`payload.ts:226-286`): non-string/`Date` input, date-only string (`2026-05-05`), boundary `shifted === now` (`>` vs `>=`), offset applied to `ResolvedOn` (only `DetectedOn` tested).
- Search/insert/update `continueOnFail` *throw* branches (non-continue path) on real build/transport failures (`*.operation.ts` catch lines).
- `isThreatCategoryForThreat` raw-value fallback `?? category` (`reportOptions.ts:282`); `addValidationError` dedupe (`payload.ts:366-367`); reportForms merge "no existing show" branch (`reportForms.ts:103-105`); transport `?? response` fallback (`transports/index.ts:71`); `NkscIvanti.execute()` never invoked (`NkscIvanti.node.ts:67-69`).

### Weak / brittle tests
- `payload.test.ts:189` mutates the shared `reportForms.initialWarning.fields` singleton in place (restored in `finally`, but a crash corrupts other tests) — build a throwaway form instead.
- `constructExecutionMetaData` mock is a passthrough, so `itemData`/`pairedItem` plumbing is never actually verified.
- Threat/category tests derive expected values from the same source module — a wrong-but-consistent value would pass. Pin at least one absolute Lithuanian string.

---

## 5. DRY

- **[High] Identical `execute` + try/catch/continueOnFail scaffolding** duplicated across all three operations — `insert.operation.ts:29-37,58-64`, `update.operation.ts:41-49,79-85`, `search.operation.ts:35-43,71-77`. Extract a shared `executeOperation(this, executeItem)` + `handleItemError(this, error, itemIndex)`.
- **[Medium] "response → returnJsonArray → constructExecutionMetaData" block** repeated verbatim 3× — extract `toExecutionData(this, data, itemIndex)`.
- **[Medium] Field-default fallback logic duplicated and drifting** — `reportForms.ts:196-218` (`getDefaultValue`) vs `insert.operation.ts:95-105` (`getFieldFallbackValue`); the latter omits `yesNo`/`boolean`/`toggle`. Unify into one resolver.
- **[Low] Magic OData literals repeated** — `'/odata/businessobject/'` in 3 operations + credential test; `'@odata.context'` in insert. Add an `ODATA_BUSINESS_OBJECT_PATH` constant / small endpoint builder.
- **[Low] `scopeOptionsExpandedField`/`lossOptionsExpandedField`** are structurally identical (`reportFields.ts:47-68`).

---

## 6. SRP

- **[High] `buildReportPayload` does 5 jobs** — `payload.ts:30-79`: applies defaults, builds payload, expands multiOptions, runs threat/category validation, and runs required/length validation + throws. Split build (`assembleReportPayload`) from validation so a payload can be built without forced validation.
- **[Medium] `getReportFieldProperties` mixes property creation, cross-form merging, and ordering** — `reportForms.ts:95-131`. Extract the merge step.
- **[Medium] `nkscIvantiApiRequest` mixes credential resolution, URL building, execution, and error normalization** — `transports/index.ts:27-75`. Extract a `handleResponse` helper.
- **[Low] `formatDateTime` couples parse/validate/future-check/offset** and uses `error.message.includes('cannot be in the future')` as control flow (`payload.ts:254`) — fragile; use a typed error.

---

## 7. Dead code

> `tsconfig` has `noUnusedLocals: true`, so unused imports/locals can't exist. Findings are limited to exports / type members / test-only surface.

- **[Medium] `'boolean'` ReportField type path is test-only** — `reportTypes.ts` (`reportFieldTypes`), `reportForms.ts:147-149,209-211`. No production field uses `type: 'boolean'` (the `validateRequiredFields` boolean is a raw `INodeProperties`, not a `ReportField`). Exercised only by a synthetic `FallbackBoolean` field in tests. Remove (and `booleanOptions`) if not a planned feature, else mark reserved with a comment.
- **[Low] `reportFieldTypes`/`reportFormIds` runtime arrays are test-only** as *runtime values* (needed at type level) — `reportTypes.ts:3-18`. Keep, but note the runtime export exists for tests.
- **[Low] Redundant type re-exports** — `reportForms.ts:7` re-exports `ReportFieldType`/`ReportFormId` which no consumer imports from the barrel. Keep `ReportField`/`ReportForm`, drop the other two.
- **[Low] Multi-hop option re-exports** `reportOptions → reportFields → reportForms` (`reportFields.ts:6-17`) — options importable via three paths; confusing. Have consumers import from `reportOptions` directly.

**Confirmed NOT dead** (checked): `buildExternalTicketFilter`, `externalTicketIdField`, `extractODataRecords`, `sanitizeResponse`, `getPayloadInput`, `getSelectedReportForm`, `getReportForm`, `threatCategoryField`, both expand toggles, `alwaysVisible`, `omitFromPayload`, `payloadName`, `formVersionOptions`, `reportFormOptions`, `defaultReportForm`, `defaultFormVersion`.

---

## 8. n8n documentation compliance

> `npm run lint` → 0 warnings, but the config uses `@n8n/node-cli/eslint`, **not** the classic `eslint-plugin-n8n-nodes-base` (declared in devDeps but not wired into `eslint.config.mjs`). The official verification linter is `npx @n8n/scan-community-package` — run it for the authoritative check.

### High
- **N8N-H1 — No `authenticate` / `IAuthenticateGeneric` on the credential** — `credentials/NkscIvantiApi.credentials.ts:35-45` + `transports/index.ts:40-43`. n8n's canonical mechanism is the credential `authenticate` object; here the `Authorization` header is hand-built in two places. Add:
  ```ts
  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: { headers: { Authorization: '={{ "rest_api_key=" + $credentials.apiKey }}' } },
  };
  ```
  then drop the manual header in the transport and the explicit header in `test.request`. ([credentials-files reference](https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/))
- **N8N-H2 — `package.json` gaps for verification** — `publishConfig.registry` points at GitHub Packages (`npm.pkg.github.com`); community nodes must be on **public npm** to be installable via the n8n UI and discoverable by the `n8n-community-node-package` keyword. Also missing `homepage` and author `email`. ([verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/), [submit community nodes](https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/))

### Medium
- **N8N-M1 — `eslint-plugin-n8n-nodes-base` not actually enforced** — `eslint.config.mjs`. A passing lint doesn't prove the `nodes-*`/`cred-*` rules pass. Either remove the unused dep or wire it in; run `npx @n8n/scan-community-package`.
- **N8N-M2 — `inputs`/`outputs` use string literals** — `NkscIvanti.node.ts:29-30`. Use `NodeConnectionTypes.Main` from `n8n-workflow`.
- **N8N-M3 — Errors omit `itemIndex`/`pairedItem`; router double-wraps** — n8n recommends `new NodeOperationError(node, error, { itemIndex })` and `pairedItem: { item: i }` on the continueOnFail branch. Remove the router re-wrap (see BUG-5). ([error-handling reference](https://docs.n8n.io/integrations/creating-nodes/build/reference/error-handling/))
- **N8N-M4 — Transport throws a bare `Error`** for missing credentials — `transports/index.ts:33-35`. Use `NodeOperationError`.

### Low
- **N8N-L1 — Custom `formVersion` param vs node versioning** — only `v1` exists and non-`v1` throws. n8n's mechanism for evolving schema is node versioning (`VersionedNodeType`). Hide the selector while one option exists, or document the rationale.
- **N8N-L3 — `subtitle` shows raw operation value** — `NkscIvanti.node.ts:24`. Consider `'={{$parameter["operation"] + ": " + $parameter["reportForm"]}}'`.
- **N8N-L4 — Non-English UI strings** — verification requires English UI/docs. Backend *values* (`Didelis`, `Taip`/`Ne`) may stay Lithuanian on the wire, but option `name`s and README prose should be English. (See COMMENT-A6 / MISC-C1.)

### Compliant
`name` scoped `@syn-con/n8n-nodes-…` (allowed); `keywords` includes `n8n-community-node-package`; `n8n` field structure; `files`/`license`/`repository`/`peerDependencies`/`engines`; Title-Case displayNames + camelCase names; `noDataExpression` on selectors; operation `action`/`description`; `usableAsTool`; credential `documentationUrl`.

---

## 9. Comments & documentation

### Comments
- **[High] COMMENT-A1 — `ivantiDateTimeOffsetHours = 3` is undocumented and DST-fragile** — `payload.ts:28,244`. It compensates for Europe/Vilnius local time entered as UTC, but hardcodes summer offset (+3 / EEST); in winter Lithuania is UTC+2, so half the year is off by an hour. Document it and prefer an IANA zone (`Europe/Vilnius`) via Luxon. (Directly related to BUG-2.)
- **[Medium] COMMENT-A3 — Conditional-required fixpoint loop unexplained** — `payload.ts:108-181`. The `while (changed)` transitive expansion and the "active OR pending" concept (a required-but-empty trigger pulls in its dependents) is the most complex logic in the repo with zero comments.
- **[Medium] COMMENT-A4 — Field-flag semantics undocumented** — `reportTypes.ts:24-39`. `visibleWhen` does double duty (editor visibility *and* payload applicability); `alwaysVisible` affects only the editor. Add JSDoc on each `ReportField` flag.
- **[Medium] COMMENT-A5 — Threat/category alias normalization undocumented** — `reportOptions.ts:249-286`. Accepts value/English name/`"N. Name"`/bare number; the `bareNameMatches.length === 1` ambiguity guard is especially subtle.
- **[Medium] COMMENT-A6 — ASCII-stripped Lithuanian descriptions** — `reportFields.ts`/`reportFormDefinitions.ts` (e.g. "Pranesejo organizacija" should be "Pranešėjo organizacija"). Inconsistent: threat *values* use full `\u` diacritics, `reportFormDefinitions.ts:276` uses real `Vos neįvykęs`, but descriptions are degraded ASCII. Pick one policy (proper Lithuanian or English).
- **[Medium] COMMENT-A7 — Stale `validateRequiredFields` description** — `update.operation.ts:28` says "the full **major incident** form"; validation is generic across the selected form. Fix to "the selected report form".
- **[Low] COMMENT-A2/A8** — add a one-liner on OData single-quote escaping (`search.operation.ts:84-86`); note `sanitizeResponse` mutates its argument (`insert.operation.ts:122-130`, see BUG-4).

### Project docs
- **[High] DOC-B6 — No LICENSE file** though `package.json` declares MIT. Add `LICENSE` (MIT, © UAB Synergy).
- **[High] DOC-B1 — README credential section** omits the default endpoint (`https://incidentai.nksc.lt/HEAT/api`) and the connectivity test request. The internal credential `name` is `tenant` (not `apiEndpoint`).
- **[Medium] DOC-B3 — Report-forms table incomplete** — README's "TypeOfCyberIncident fixed to Didelis" is true only for major; minor also fixes it (`Nedidelis`) and near-miss (`Vos neįvykęs`). Add fixed values per row.
- **[Medium] DOC-B7/B9 — No CHANGELOG**; formVersion, expand toggles, and threat-alias features are undocumented.
- **[Low] DOC-B8 — No CONTRIBUTING; no JSDoc** on exported functions (`buildReportPayload`, `validateReportPayload`, `buildApiBaseUrl`, `normalizeThreatValue`, …).

---

## 10. Other / additional observations

- **MISC-C1 — No i18n / translation files** — the domain is Lithuanian; n8n supports per-node translation JSON. Current half-English / half-ASCII-Lithuanian state is the worst of both. Systemic fix for COMMENT-A6 / N8N-L4.
- **MISC-C2 — `ThreatCategory` shown regardless of `Threat`** — `reportFields.ts:21-29` has no `visibleWhen`; users can pick an invalid combination and only fail at execution (`payload.ts:373-384`). Gate visibility on `Threat`, or document the cross-field rule. Also `fieldDisplayOrder` (`reportForms.ts:29-84`) silently dumps any unlisted field at the bottom — maintenance trap; add a comment.
- **MISC-C4 — No codex `*.node.json`** — add for category (e.g. Security / ITSM) and nodes-panel discoverability.
- **MISC-C5 — Distribution constraint** — GitHub Packages registry means consumers need GH auth and the node **cannot** be installed via the n8n community-nodes UI. If intentional (internal distribution), document it; otherwise publish to public npm. (See N8N-H2.)
- **MISC-C6 — Repo metadata gaps** — no `bugs.url`, no `homepage`, author has no email/url.
- **MISC-C5b — gulpfile icon copy is fire-and-forget** — `gulpfile.js`: the node-icon stream isn't returned/awaited (only the credential stream is). Low-risk race under gulp 5; tighten with `merge-stream` or a combined return.
- **MISC-C7 — Credential field `tenant`** is a misleading internal name for an endpoint URL; `apiEndpoint` would be clearer (breaking credential change).

---

## Appendix — commands run
- `npm audit` / `npm audit --omit=dev` → 42 dev-only advisories; 0 production.
- `npm run lint` → 0 warnings (note: not the classic n8n-nodes-base plugin).
- `npx tsc --noEmit` → clean (3 additional issues surface under `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`).
- `npm test` → 67 passing; `npm run test:coverage` → ~98.6% stmts / 93.3% branch.
