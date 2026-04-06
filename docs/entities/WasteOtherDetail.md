# WasteOtherDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = other on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `description` | text | Freeform |

## Notes

Catch-all for waste that doesn't fit the other five reason types. If a specific "other" reason recurs frequently, it may warrant its own reason code and detail table in a future update.
