# RecipeVersion

> Part of [[Feature 8 - Recipes]]

A snapshot of a [[Recipe]] at a point in time. Created on each edit to preserve history.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `recipe_version_id` | PK | |
| `recipe_id` | FK → [[Recipe]] | |
| `version_number` | integer | |
| `yield_quantity` | numeric | |
| `yield_unit` | text | |
| `prep_time_minutes` | integer | |
| `cook_time_minutes` | integer | |
| `created_by` | text FK → [[User]] | Clerk user ID |
| `created_at` | timestamp | |
| `deleted_at` | timestamp | Nullable — soft delete |

## Relationships

- Belongs to [[Recipe]]
- Has many [[RecipeIngredient]]s
- Has many [[RecipeStep]]s
- Referenced by [[BatchEvent]] — batches point to the exact version used
