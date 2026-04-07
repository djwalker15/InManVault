# RecipeIngredient

> Part of [[Feature 8 - Recipes]]

An ingredient line in a [[RecipeVersion]]. Can reference a specific [[Product]], a [[ProductGroup]] (generic ingredient), another [[Recipe]] (sub-recipe), or a free-text name (unlinked). Exactly one must be set.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `recipe_ingredient_id` | PK | |
| `recipe_version_id` | FK → [[RecipeVersion]] | |
| `product_id` | FK → [[Product]] | Nullable — specific product |
| `product_group_id` | FK → [[ProductGroup]] | Nullable — generic product group (e.g., "Sugar") |
| `sub_recipe_id` | FK → [[Recipe]] | Nullable — another recipe's output as an ingredient |
| `free_text_name` | text | Nullable — unlinked ingredient, typed by user but not resolved to any Product or group |
| `quantity` | numeric | |
| `unit` | text | Resolved via [[UnitDefinition]] for conversion |
| `sort_order` | integer | |
| `notes` | text | |

## Constraint

**Exactly one** of `product_id`, `product_group_id`, `sub_recipe_id`, or `free_text_name` must be non-null.

| Reference Type | What It Means | Cost Calculation | Inventory Deduction at Batch Time |
|---------------|---------------|-----------------|----------------------------------|
| `product_id` | Specific product (e.g., "Domino Sugar 4lb") | Uses `last_unit_cost` from matching [[InventoryItem]] | Deducts from the specific InventoryItem |
| `product_group_id` | Generic product (e.g., "Sugar") | Uses cost from whichever InventoryItem the user selects at batch time | User prompted to choose which InventoryItem (FIFO suggestion) |
| `sub_recipe_id` | Another recipe's output | Recursive cost from sub-recipe | Deducts from InventoryItem of the sub-recipe's output, or triggers sub-batch |
| `free_text_name` | Unlinked ingredient | ⚠️ Skipped — cost incomplete | ❌ Blocked — recipe cannot be batched until linked |

## Unlinked Ingredients

When `free_text_name` is set (and all FKs are null), the ingredient is **unlinked**:
- The recipe can be saved and viewed
- Cost calculation marks it as "missing cost data"
- **Batching is blocked** until the ingredient is linked to a Product, ProductGroup, or sub-Recipe
- The recipe shows a visual indicator: "2 ingredients need linking"

## Circular Reference Guard

When `sub_recipe_id` is set:
- **App layer** checks before saving and provides a friendly error if a cycle is detected
- **DB trigger** fires on INSERT/UPDATE, walks the sub-recipe chain via recursive CTE, raises exception if a cycle is found

## Immutable

RecipeIngredients are never modified after creation — they belong to a frozen [[RecipeVersion]]. New versions create new ingredient rows.

## See Also

- [[Product]] — specific purchasable items
- [[ProductGroup]] — generic ingredient concepts
- [[Recipe]] — sub-recipe references
- [[Cost Data Flow]] — ingredient costs are the foundation of recipe cost calculation
- [[UnitDefinition]] — unit conversion for comparing ingredient units to inventory units
- [[Journey - Creating a Recipe]] — how ingredients are added during recipe creation
