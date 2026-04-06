# WasteExpiredDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = expired on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `expiry_date` | date | |
| `days_past_expiry` | integer | |
| `space_id` | FK → [[Space]] | Where the item was stored |
| `was_opened` | bool | |

## Diagnostic Value

Tracks whether items are expiring because they're stored in hard-to-see locations, or because they were opened and forgotten. Combined with [[Space]] data, enables insights like "items in the back of Shelf 3 expire more often."
