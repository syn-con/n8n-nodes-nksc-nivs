# n8n Verification Review — `@syn-con/n8n-nodes-nksc-ivanti`

Reviewed against n8n's community-node guidance:

- Lint: <https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool#lint-your-node>
- Verification: <https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines>

The docs specify the lint check as `npx @n8n/scan-community-package n8n-nodes-PACKAGE`. That scanner's
ESLint/security rules **pass**; the npm-provenance half of the scanner cannot run until the package is
published to npm with provenance.

## Lint results (all verified, exit 0)

| Check | Command | Result |
| --- | --- | --- |
| Scanner ESLint (`@n8n/eslint-plugin-community-nodes` recommended + `no-console`, on built `dist/`) | `@n8n/scan-community-package` → `analyzePackage` | pass |
| Project ESLint (`eslint-plugin-n8n-nodes-base`, on `.ts` source, `--max-warnings=0`) | `npm run lint` | pass (clean) |
| n8n-node CLI lint (the command the docs reference) | `n8n-node lint` (node-cli v0.16.0) | pass |

Note: the scanner's **provenance** check is separate from ESLint and remains unverifiable until the
package is published to npm with provenance (see Blocker 2).

## Passing

| Requirement | Evidence |
| --- | --- |
| Integrates exactly one third-party service | Ivanti only |
| Not a duplicate / not a logic or flow node | NKSC-Ivanti report node |
| Written in TypeScript | all `nodes/`, `credentials/` are `.ts` |
| Zero external runtime dependencies | `package.json` has no `dependencies` block; only `peerDependencies: n8n-workflow` |
| No environment-variable access | grep of `nodes/` + `credentials/` → 0 hits for `process.env` |
| No filesystem / child_process I/O | grep → 0 hits |
| All data via node parameters | confirmed in operations/transport |
| Passes all lint checks | scanner ESLint, `npm run lint`, and `n8n-node lint` all exit 0 (see Lint results) |
| License is MIT | `"license": "MIT"` + `LICENSE` file |
| Repo metadata consistent | `homepage`/`repository`/`bugs` → `github.com/syn-con/n8n-nodes-nksc-ivanti`; author `UAB Synergy` |
| Uses the n8n-node tool | `@n8n/node-cli` devDep; `lint`/`lint:fix` scripts present |
| Error handling & validation | `NodeOperationError`/`NodeApiError`, `continueOnFail`, payload validation, credential test request |
| README in English w/ operations, credential setup, auth | `README.md` covers all three ops, credential fields, auth, examples |

## Blockers for verification

### 1. Interface is not English-only — `description`/help text is Lithuanian (~32 strings)

`reportFields.ts` (23), `reportFormDefinitions.ts` (5), `reportOptions.ts` (4). Examples:
`"Pranesejo organizacija"`, `"Pavadinimas"`, `"Kibernetines gresmes pogrupis"`,
`"Ar reikalinga pagalba suvaldant incidenta?"`. The guideline is explicit: *"All descriptions, help
text, error messages in English"* and *"Parameter names in English."* The `displayName`s and error
messages **are** English — it is specifically the field **descriptions** that violate this.

Distinction: Ivanti enum **values** sent over the wire (`Taip`/`Ne`, `Didelis`, `Nedidelis`,
`Vos neįvykęs`) are API data, not interface language — those legitimately stay Lithuanian. Only the
editor-facing `description` text needs translating (the Lithuanian original can be kept in parentheses
to help operators map to the real NKSC form).

### 2. Not published via a GitHub Action with a provenance statement

There is no `.github/workflows/` directory, and the package returns 404 on npm (not yet published).
Verification requires *"Published via GitHub action with provenance statement included."* This is the
one lint-check half the scanner could not validate. A publish workflow running `npm publish --provenance`
from CI is required.

## Confirm before submitting

- **Public GitHub repo + working git link.** `package.json` points at
  `github.com/syn-con/n8n-nodes-nksc-ivanti`, but nothing is on npm yet, so the repo's public visibility
  and link resolution are unconfirmed. Verify both.
- **Example workflow.** README has good expression/usage docs but no example workflow JSON. The guideline
  lists *"example workflows"* — consider adding an exported `.json`.
- **Scoped package name** (`@syn-con/…`). The scanner's `package-name-convention` rule passed, so this is
  accepted — noted only because some tooling/docs assume the bare `n8n-nodes-*` form.

## Bottom line

The technical bar (no deps, no env/fs, TypeScript, error handling, MIT, scanner-clean) is **met**. Two
hard blockers remain before verification: **translate the Lithuanian field descriptions to English**, and
**set up provenance publishing via GitHub Actions**.
