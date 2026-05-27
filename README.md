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
| `Update NKSC Report` | Updates an existing Ivanti record | `Record ID`, optional required-field validation |
| `Search NKSC Report` | Searches reports by external ticket ID | `External Ticket ID` |

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

### Conditional fields

Some fields remain visible in the editor even when their values are only required under certain conditions. That keeps them available for expression-driven workflows while preserving backend validation rules.

### Search behavior

Search uses the selected report form to choose the Ivanti business object, then filters by external ticket ID. If Ivanti returns multiple matching records, the node returns them all.

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
