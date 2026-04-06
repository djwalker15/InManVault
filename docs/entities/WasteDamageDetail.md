# WasteDamageDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = damaged on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `how_damaged` | text | |
| `space_id` | FK → [[Space]] | Where it happened |
| `packaging_issue` | bool | Was the packaging the cause? |

## Diagnostic Value

Identifies whether damage is a handling issue or a packaging/storage problem. If `packaging_issue` is frequently true for a specific [[Product]], it may warrant switching brands or storage methods.
