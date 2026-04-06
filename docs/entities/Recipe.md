# Recipe

> Part of [[Feature 8 - Recipes]]

A formula for producing something from ingredients. Can reference [[Product]]s and/or other Recipes as ingredients (nested recipes). Supports versioning and scaling.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `recipe_id` | PK | |
| `name` | text | |
| `description` | text | |
| `yield_quantity` | numeric | Base yield |
| `yield_unit` | text | |
| `prep_time_minutes` | integer | |
| `cook_time_minutes` | integer | |
| `photo_url` | text | |
| `output_product_id` | FK → [[Product]] | **Nullable.** Defines what Product this recipe produces when batched with store intent. Null for consume-only recipes (meals). |
| `crew_id` | FK → [[Crew]] | Nullable — null = shared, populated = crew-private |
| `created_by` | text FK → [[User]] | Clerk user ID |
| `current_version` | FK → [[RecipeVersion]] | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `deleted_at` | timestamp | Nullable — soft delete |

## Key Decisions

- **Output product link:** `output_product_id` connects a Recipe to the [[Product]] it produces. When a [[BatchEvent]] with store/split intent completes, this determines what [[InventoryItem]] to create. If null, store/split intent is blocked at the app layer.
- **Nested recipes:** A [[RecipeIngredient]] can reference either a [[Product]] or another Recipe (as a sub-recipe). E.g., Margarita uses Simple Syrup, which is itself a Recipe.
- **Cost calculation:** Recursive — rolls up ingredient costs through sub-recipes. See [[Cost Data Flow]].
- **Scaling:** Runtime calculation. `desired_yield ÷ base yield = scale_factor`, applied to all ingredient quantities.
- **Versioning:** Each edit creates a new [[RecipeVersion]]. [[BatchEvent]]s reference a specific version so historical batches remain accurate.
- **Sharing:** Same nullable `crew_id` pattern as [[Product]] and [[Category]]. See [[Nullable crew_id Pattern]].
- **Circular reference guard:** Both app-level validation (friendly error) and a DB trigger on [[RecipeIngredient]] (recursive CTE cycle detection) prevent Recipe A → Recipe B → Recipe A chains.
- **Soft delete:** Uses `deleted_at`. Historical [[BatchEvent]]s and [[WastePrepFailureDetail]]s can still reference deleted recipes.

## Relationships

- Optionally belongs to [[Crew]]
- References [[Product]] as `output_product_id`
- Has many [[RecipeVersion]]s
- Has many [[RecipeIngredient]]s (via current version)
- Has many [[RecipeStep]]s (via current version)
- Referenced by [[BatchEvent]] (via [[RecipeVersion]])
- Referenced by [[WastePrepFailureDetail]]
- Referenced by [[ShoppingListItem]] (as source for recipe-driven shopping)
