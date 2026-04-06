# WasteSpoilageDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = spoiled on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `expiry_date` | date | |
| `space_id` | FK → [[Space]] | Where stored |
| `container_type` | text | What kind of container it was in |
| `days_since_opened` | integer | |
| `storage_conditions` | text | e.g., "left out overnight" |

## Diagnostic Value

Captures environmental factors that caused spoilage — storage location, container type, and conditions. Enables insights like "items stored in Tupperware spoil faster than items in glass containers."
