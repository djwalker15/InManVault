# SpaceTemplate

> Part of [[Feature 2 - Space Hierarchy Setup]]

Pre-built hierarchy blueprints that a [[Crew]] can stamp out and customize during setup.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `template_id` | PK | |
| `name` | text | e.g., "Standard Kitchen", "Walk-in Pantry", "Bar Setup" |
| `description` | text | |
| `template_data` | JSON | The hierarchy tree to instantiate |
| `crew_id` | FK → [[Crew]] | Nullable — null = system-provided, populated = crew-created |
| `created_by` | text FK → [[User]] | Clerk user ID |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Key Decisions

- System-provided templates ship with InMan (e.g., "Standard Kitchen")
- [[Crew]]s can save their own setup as a reusable template
- Stamping a template creates real [[Space]] rows owned by the [[Crew]]
- **Soft delete:** Uses `deleted_at`.
