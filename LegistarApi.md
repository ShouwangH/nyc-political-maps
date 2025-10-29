# Legistar API Notes

Working with the NYC Legistar API exposed some un-documented behaviours that are worth keeping close at hand when expanding the visualization stack. This file captures the essentials for future integrations.

## Authentication & Basics

- **Token is mandatory** on every request: append `?token=<NYC_LEGISTAR_TOKEN>` (or `&token=…` when chaining parameters).
- All endpoints are **case-sensitive** and pluralised exactly as shown below (e.g. `/events`, not `/Events`).
- Responses are JSON; most collections support `$top`, `$skip`, and basic `$orderby` OData options, but more advanced `$filter` queries are hit-or-miss and should be verified individually.

## Critical Resources & Relationships

| Purpose | Endpoint | Notes |
| --- | --- | --- |
| Issue catalog | `GET /Matters` | Use `$top`, `$orderby=MatterPassedDate desc`, `$skip` for pagination. No reliable `$filter` on year/date—plan to sift client-side. |
| Matter timeline | `GET /Matters/{MatterId}/Histories` | Reveals which events handled a matter and whether a roll call occurred (`MatterHistoryRollCallFlag`). |
| Event lookup | `GET /Events/{EventId}` | Returns a single meeting. Query string flag `EventItems=true` embeds agenda items, but we found the dedicated endpoint below more predictable. |
| Agenda items | `GET /events/{EventId}/eventitems` | Supplies each agenda line; `EventItemRollCallFlag === 1` indicates roll-call data available. `EventItemMatterId` links back to the source matter. |
| Roll-call votes | `GET /eventitems/{EventItemId}/rollcalls` | Member-level vote records (`RollCallPersonId`, `RollCallValueName`, etc.). |
| Member roster | `GET /Bodies/{BodyId}/OfficeRecords` | `BodyId=1` is the City Council. `OfficeRecordExtraText` carries the district label (e.g. `"District 6"`). Filter by `OfficeRecordEndDate` to pick the current term. |
| Person details | `GET /Persons/{PersonId}` | Helpful for validating names when building a static member→district map, but district data comes from `OfficeRecords`. |

### Data Flow We Will Use

1. **List candidate matters** via `/Matters` (likely constrained to recent `MatterStatusName` values and limited with `$top`).
2. For a selected matter, pull `/Matters/{MatterId}/Histories` and locate the latest entry with `MatterHistoryRollCallFlag === 1`. This entry references `MatterHistoryEventId`.
3. Fetch the meeting via `/events/{EventId}/eventitems` and pick the agenda item that matches the matter (via `EventItemMatterId`).
4. Retrieve individual votes from `/eventitems/{EventItemId}/rollcalls`.
5. Map each `RollCallPersonId` to a council district using cached `OfficeRecords` (latest `OfficeRecordEndDate`, take `OfficeRecordExtraText`, strip `"District "` prefix to preserve string join key).

## Query Tips & Gotchas

- **Date filters expect US-style dates** (`startdate=1/1/2024`). ISO formats (`2024-01-01`) return empty results.
- The API happily returns very old records first; batch requests should paginate and then filter locally for 2023/2024 sessions.
- `/events/{id}` accepts future meeting IDs (e.g. agendas scheduled months ahead). Always check `EventDate` versus `Date.now()` before assuming vote data exists.
- `RollCallValueName` includes statuses like `"Yes"`, `"No"`, `"Abstain"`, `"Present"`, `"Excused"`. Map everything outside `{Yes, No, Abstain}` to the MVP’s `"Missing"` colour unless Phase 2 broadens the palette.
- Office records include former members. Filter to the most recent term (`OfficeRecordStartDate >= 2024-01-01` or `OfficeRecordEndDate` null/in the future) to avoid stale district assignments.

## Sample Requests

```bash
# Recent matters (cap at 50 records)
curl -s "https://webapi.legistar.com/v1/nyc/Matters?$top=50&token=$NYC_LEGISTAR_TOKEN"

# Histories for a specific matter
curl -s "https://webapi.legistar.com/v1/nyc/Matters/75717/Histories?token=$NYC_LEGISTAR_TOKEN"

# Event agenda items
curl -s "https://webapi.legistar.com/v1/nyc/events/21593/eventitems?token=$NYC_LEGISTAR_TOKEN"

# Roll-call votes tied to that agenda item
curl -s "https://webapi.legistar.com/v1/nyc/eventitems/419821/rollcalls?token=$NYC_LEGISTAR_TOKEN"

# Active council roster (2024-2025 term)
curl -s "https://webapi.legistar.com/v1/nyc/Bodies/1/OfficeRecords?token=$NYC_LEGISTAR_TOKEN" |
  jq 'map(select(.OfficeRecordEndDate == null or .OfficeRecordEndDate >= "2025-01-01T00:00:00")))'
```

## Normalization Checklist

When fleshing out the backend service:

1. Normalize vote values to `{Yes, No, Abstain, Missing}`.
2. Cache Person→District lookups in-memory alongside their `OfficeRecordPersonId`.
3. Keep the Legistar token server-side; never expose it to the browser.
4. Handle request throttling—Legistar occasionally slows down, so wrap fetches with retries/backoff once Phase 1 traffic validates the pattern.
5. Store timestamps of the last successful pull per matter to avoid redundant calls within a single server session (still in-memory per non-negotiables).

This outline should keep future map or analytics efforts aligned with the MVP data contracts while avoiding another round of endpoint archaeology.
