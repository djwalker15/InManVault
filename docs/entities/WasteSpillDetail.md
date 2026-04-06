# WasteSpillDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = spilled on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `space_id` | FK → [[Space]] | Where spilled |
| `how_spilled` | text | |
| `during_activity` | text | What was happening when it spilled |

## Diagnostic Value

Captures where and how spills occur. If spills frequently happen at a specific [[Space]] (e.g., a cramped prep station), it may indicate a layout problem.
