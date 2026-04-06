# Feature 10 — Shopping List

## Entities

- [[ShoppingList]] — named, collaborative list
- [[ShoppingListItem]] — line item with source tracking

## Summary

Multiple named lists per [[Crew]]. Four sources: manual, low stock alerts, recipe needs, planned batches — tracked per line item for prioritization. Collaborative. Checking off an item creates a purchase [[Flow]], auto-updating inventory.

## Item Sources

| Source | Trigger | Priority |
|--------|---------|----------|
| manual | User added directly | User-defined |
| low_stock | [[InventoryItem]] below `min_stock` | Essential |
| recipe | "I want to make X" — missing [[RecipeIngredient]]s | Plan-dependent |
| meal_plan | Planned [[BatchEvent]] needs ingredients | Plan-dependent |

## Dependencies

- [[Feature 3 - Item Catalog]] — line items reference [[Product]]s
- [[Feature 7 - In-Out Flows]] — checkout creates purchase [[Flow]]s
- [[Feature 4 - Inventory Level Tracking]] — low stock alerts generate list items
- [[Feature 8 - Recipes]] — recipe needs generate list items
- [[Feature 9 - Batching and Prepping]] — planned batches generate list items
