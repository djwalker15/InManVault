# RecipeIngredient

> Part of [[Feature 8 - Recipes]]

An ingredient line in a [[RecipeVersion]]. References either a [[Product]] (base ingredient) or another [[Recipe]] (sub-recipe), never both.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `recipe_ingredient_id` | PK | |
| `recipe_version_id` | FK → [[RecipeVersion]] | |
| `product_id` | FK → [[Product]] | Nullable |
| `sub_recipe_id` | FK → [[Recipe]] | Nullable |
| `quantity` | numeric | |
| `unit` | text | Resolved via [[UnitDefinition]] for conversion |
| `sort_order` | integer | |
| `notes` | text | |

## Constraints

- **Exactly one** of `product_id` or `sub_recipe_id` must be non-null. An ingredient is either a base [[Product]] or another [[Recipe]]'s output.
- **Circular reference guard:** A DB trigger fires on INSERT/UPDATE where `sub_recipe_id` is not null. It walks the sub-recipe chain via recursive CTE and raises an exception if a cycle is detected. The app layer also checks before saving for a friendly error message.

## Immutable

RecipeIngredients are never modified after creation — they belong to a frozen [[RecipeVersion]]. New versions create new ingredient rows.

## See Also

- [[Cost Data Flow]] — ingredient costs are the foundation of recipe cost calculation
- [[UnitDefinition]] — unit conversion for comparing ingredient units to inventory units
