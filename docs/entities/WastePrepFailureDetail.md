# WastePrepFailureDetail

> Part of [[Feature 6 - Waste Tracking]]

Context for waste where `waste_reason` = prep_failure on [[WasteEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | FK → [[WasteEvent]] | |
| `recipe_id` | FK → [[Recipe]] | What was being attempted |
| `batch_id` | FK → [[BatchEvent]] | Nullable — if logged during a batch |
| `what_went_wrong` | text | |
| `prepped_by` | text FK → [[User]] | Clerk user ID |

## Diagnostic Value

Links waste to specific [[Recipe]]s and [[User]]s. Enables insights like "Recipe X has a 15% failure rate" or training opportunities for specific crew members. The `batch_id` link preserves the full context of the failed [[BatchEvent]].
