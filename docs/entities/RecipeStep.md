# RecipeStep

> Part of [[Feature 8 - Recipes]]

A step in a [[RecipeVersion]]'s instructions.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `recipe_step_id` | PK | |
| `recipe_version_id` | FK → [[RecipeVersion]] | |
| `step_number` | integer | |
| `instruction` | text | |
| `photo_url` | text | Nullable |

## Relationships

- Belongs to [[RecipeVersion]]
