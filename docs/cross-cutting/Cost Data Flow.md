# Cost Data Flow

> Cross-cutting concern spanning multiple features

Cost enters the system through purchase [[Flow]]s and flows through the entire data model.

## The Pipeline

| Step | Action | Where Cost Lives |
|------|--------|-----------------|
| 1 | **Purchase** | `unit_cost` on [[Flow]], `last_unit_cost` cached on [[InventoryItem]] |
| 2 | **Recipe costing** | [[Recipe]] cost = sum of ([[RecipeIngredient]] quantity × ingredient unit_cost), recursive through sub-recipes. Units normalized via [[UnitDefinition]]. |
| 3 | **Batch costing** | [[BatchEvent]] `total_cost` = sum of [[BatchInput]] costs |
| 4 | **Derived item costing** | Stored [[BatchOutput]]'s [[InventoryItem]] gets cost from batch. Output product defined by [[Recipe]]'s `output_product_id`. |
| 5 | **Waste costing** | [[WasteEvent]] `total_cost` uses cost at time of waste, including derived cost for batch-produced items |
| 6 | **Meal costing** | Consume [[BatchEvent]]s track `total_cost` even when nothing enters inventory |
| 7 | **Shopping list** | `unit_cost` captured at checkout on [[ShoppingListItem]] |

## Key Insight

A wasted bottle of housemade simple syrup doesn't just cost "a bottle" — it costs the sum of sugar + water + labor that went into producing it. This recursive cost calculation flows from [[RecipeIngredient]] → [[BatchEvent]] → [[InventoryItem]] → [[WasteEvent]].

## Quantity as Cache

`quantity` on [[InventoryItem]] is a cached value, updated on every [[Flow]] for fast reads. The [[Flow]] ledger is the canonical source. A reconciliation function corrects drift periodically. All cost calculations should reference flow data when historical accuracy matters.

## Features Involved

- [[Feature 3 - Item Catalog]] — `last_unit_cost` on [[InventoryItem]]
- [[Feature 7 - In-Out Flows]] — purchase [[Flow]]s establish cost
- [[Feature 8 - Recipes]] — recursive ingredient cost calculation, `output_product_id` link
- [[Feature 9 - Batching and Prepping]] — batch total cost and derived item cost
- [[Feature 6 - Waste Tracking]] — waste cost reporting including derived costs
- [[Feature 10 - Shopping List]] — cost captured at checkout
