# NKSC NIVS n8n Node

`n8n` community node for creating, updating, and searching NKSC security incident reports in NKSC NIVS.

## Overview

The node exposes the NKSC report forms directly in the n8n editor and builds the NKSC NIVS request body from the selected form and entered values.

It handles:

- report selection
- field visibility and conditional requirements
- payload shaping for the selected NKSC NIVS business object
- search by external ticket ID

## Supported Operations

| Operation | What it does | Input |
| --- | --- | --- |
| `Insert Report` | Creates a new report in NKSC NIVS | Select a report form and fill in the fields |
| `Update Report` | Updates an existing NKSC NIVS record | `Record ID`, update mode, fields to update |
| `Search Report` | Searches reports by external ticket ID | `External Ticket ID`, `Return All` or `Search Limit` |

## Report Forms

| Form | NKSC NIVS object | Notes |
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
6. The node sends the request to the correct NKSC NIVS endpoint.
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

The required-by-default fields in the node match the audited NKSC HTML forms. The reporter identity fields are additional required inputs enforced by NKSC NIVS.

### Value types

- `Taip` / `Ne` fields stay as validated string values
- scope and loss options are boolean flags
- expandable scope and loss groups can be shown either as one compact selector or as separate boolean switches

### Expression inputs

Most fields can be driven by expressions using the same value shape shown in the editor: strings for text fields, `Taip` / `Ne` for yes-no fields, booleans for switches, and date-time values for date fields.

Some selector fields accept extra expression formats to make generated workflows easier to maintain:

- `Fields To Update` in `Selected Fields` update mode accepts field names, full numbered labels, one-based numbers, comma-separated numbers, or a numeric array. For example, `Summary`, `7`, `1,2,3`, and `[1,2,3]` are valid expression results.
- `Threat` and `Threat Category` accept the NKSC NIVS value, the numbered English label, the unnumbered English label, or the option number. For example, `2`, `2. Malware`, and `Malware` all resolve to the same threat option.
- Compact `Scope Options` and `Loss Options` selectors expect arrays of option field names, such as `["ScopeOption2"]`. For expression-heavy workflows, turn on the matching `Expand ... Options` toggle and drive the separate boolean fields instead.

### Conditional fields

Some fields remain visible in the editor even when their values are only required under certain conditions. That keeps them available for expression-driven workflows while preserving backend validation rules.

### Update behavior

`Update Report` defaults to `Selected Fields` mode. In this mode, the node only sends the fields selected in `Fields To Update`; the selector labels are numbered so expressions can pass values like `1,2,3` or `[1,2,3]`.

`Full Form` mode sends the selected form payload and can optionally validate required fields before patching the NKSC NIVS record.

### Search behavior

Search uses the selected report form to choose the NKSC NIVS business object, then filters by external ticket ID. By default it returns up to `Search Limit` records (defaulting to 10). Enable `Return All` to page through every matching record instead of stopping at the limit.

## Credential Setup

Use the `NKSC NIVS API` credential.

| Field | Purpose |
| --- | --- |
| `API Endpoint` | Full NKSC NIVS API endpoint URL. Defaults to `https://incidentai.nksc.lt/HEAT/api` |
| `API Key` | REST API key used for authentication |

Behavior:

- bare hostnames are normalized to HTTPS
- explicit `http://...` URLs are preserved
- trailing slashes are trimmed before the request URL is built
- n8n tests the credential with `GET /odata/businessobject/XSC_SecurityReport__DetailReports`

Examples:

- `https://nivs.example.local/HEAT/api`
- `https://nivs.example.local/api`
- `http://nivs.local/HEAT/api`

## Development

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```
