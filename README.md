# NKSC Ivanti n8n Node

`n8n` community node for creating, updating, and searching NKSC security incident reports in Ivanti.

## Overview

The node exposes the NKSC report forms directly in the n8n editor and builds the Ivanti request body from the selected form and entered values.

It handles:

- report selection
- field visibility and conditional requirements
- payload shaping for the selected Ivanti business object
- search by external ticket ID

## Supported Operations

| Operation | What it does | Input |
| --- | --- | --- |
| `Insert NKSC Report` | Creates a new report in Ivanti | Select a report form and fill in the fields |
| `Update NKSC Report` | Updates an existing Ivanti record | `Record ID`, update mode, fields to update |
| `Search NKSC Report` | Searches reports by external ticket ID | `External Ticket ID`, optional `Search Limit` |

## Report Forms

| Form | Ivanti object | Notes |
| --- | --- | --- |
| Initial warning | `XSC_SecurityReport__InitialReports` | Initial warning records |
| Major cyber incident | `XSC_SecurityReport__DetailReports` | `TypeOfCyberIncident` is fixed to `Didelis` |
| Minor cyber incident | `XSC_SecurityReport__DetailReports` | `TypeOfCyberIncident` is fixed to `Nedidelis`; includes threat and final report fields |
| Near miss | `XSC_SecurityReport__DetailReports` | `TypeOfCyberIncident` is fixed to `Vos neįvykęs` |

## How It Works

1. The user selects an operation.
2. The user selects a report form.
3. The node loads the matching form definition.
4. The editor shows the fields and controls for that form.
5. The payload builder applies defaults, visibility rules, and conditional validation.
6. The node sends the request to the correct Ivanti endpoint.
7. The response is returned as n8n output items.

Request methods:

- `Insert` uses `POST`
- `Update` uses `PATCH`
- `Search` uses `GET`

## Field Behavior

### Required fields

Fields marked required in the form definition are required in the editor and validated before the request is sent.

Reporter identity fields are required on every form:

- `Organization`
- `Reporter`
- `ReporterEmail`
- `ReporterPhone`
- `ReporterTitle`

The required-by-default fields in the node match the audited NKSC HTML forms. The reporter identity fields are additional required inputs enforced by Ivanti.

### Value types

- `Taip` / `Ne` fields stay as validated string values
- scope and loss options are boolean flags
- expandable scope and loss groups can be shown either as one compact selector or as separate boolean switches

### Expression inputs

Most fields can be driven by expressions using the same value shape shown in the editor: strings for text fields, `Taip` / `Ne` for yes-no fields, booleans for switches, and date-time values for date fields.

Some selector fields accept extra expression formats to make generated workflows easier to maintain:

- `Fields To Update` in `Selected Fields` update mode accepts field names, full numbered labels, one-based numbers, comma-separated numbers, or a numeric array. For example, `Summary`, `7`, `1,2,3`, and `[1,2,3]` are valid expression results.
- `Threat` and `Threat Category` accept the Ivanti value, the numbered English label, the unnumbered English label, or the option number. For example, `2`, `2. Malware`, and `Malware` all resolve to the same threat option.
- Compact `Scope Options` and `Loss Options` selectors expect arrays of option field names, such as `["ScopeOption2"]`. For expression-heavy workflows, turn on the matching `Expand ... Options` toggle and drive the separate boolean fields instead.

### Conditional fields

Some fields remain visible in the editor even when their values are only required under certain conditions. That keeps them available for expression-driven workflows while preserving backend validation rules.

### Update behavior

`Update NKSC Report` defaults to `Selected Fields` mode. In this mode, the node only sends the fields selected in `Fields To Update`; the selector labels are numbered so expressions can pass values like `1,2,3` or `[1,2,3]`.

`Full Form` mode sends the selected form payload and can optionally validate required fields before patching the Ivanti record.

### Search behavior

Search uses the selected report form to choose the Ivanti business object, then filters by external ticket ID and returns up to the configured limit, defaulting to 10 records.

## Credential Setup

Use the `NKSC Ivanti API` credential.

| Field | Purpose |
| --- | --- |
| `API Endpoint` | Full Ivanti API endpoint URL. Defaults to `https://incidentai.nksc.lt/HEAT/api` |
| `API Key` | REST API key used for authentication |

Behavior:

- bare hostnames are normalized to HTTPS
- explicit `http://...` URLs are preserved
- trailing slashes are trimmed before the request URL is built
- n8n tests the credential with `GET /odata/businessobject/XSC_SecurityReport__DetailReports`

Examples:

- `https://ivanti.example.local/HEAT/api`
- `https://ivanti.example.local/api`
- `http://ivanti.local/HEAT/api`

## Development

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```
