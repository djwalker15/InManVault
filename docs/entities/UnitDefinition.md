# UnitDefinition

> Cross-cutting reference data for [[Feature 4 - Inventory Level Tracking]], [[Feature 8 - Recipes]], [[Feature 9 - Batching and Prepping]]

System-seeded reference table that provides conversion factors within unit categories. Enables the app layer to convert between compatible units (e.g., oz ↔ g, ml ↔ cups) when comparing recipe ingredient requirements against inventory quantities.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `unit` | text PK | e.g., "oz", "ml", "g", "count" |
| `unit_category` | enum | weight \| volume \| count |
| `base_unit` | text | Canonical unit for the category (g for weight, ml for volume, count for count) |
| `to_base_factor` | numeric | Multiplier to convert to the base unit |

## Seed Data

| unit | unit_category | base_unit | to_base_factor |
|------|--------------|-----------|---------------|
| g | weight | g | 1 |
| kg | weight | g | 1000 |
| oz | weight | g | 28.3495 |
| lbs | weight | g | 453.592 |
| ml | volume | ml | 1 |
| L | volume | ml | 1000 |
| tsp | volume | ml | 4.929 |
| tbsp | volume | ml | 14.787 |
| cup | volume | ml | 236.588 |
| fl_oz | volume | ml | 29.574 |
| count | count | count | 1 |
| pkg | count | count | 1 |

## Key Decisions

- **Within-category conversion only.** Weight ↔ weight and volume ↔ volume are supported. Cross-category (weight ↔ volume) requires per-product density data and is blocked with a clear error.
- **System-seeded, not crew-editable.** Standard conversions don't vary between crews.
- **Immutable.** No `deleted_at`, no `updated_at` — this is static reference data.
- The app layer converts all within-category comparisons to base units before comparing or deducting.

## Relationships

- Referenced by the app layer when resolving units on [[InventoryItem]], [[RecipeIngredient]], [[BatchInput]], [[Flow]], and [[ShoppingListItem]]

## See Also

- [[Feature 8 - Recipes]] — recipe ingredients may use different units than inventory
- [[Feature 9 - Batching and Prepping]] — batch deductions need unit conversion
