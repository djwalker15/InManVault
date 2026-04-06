# ShoppingListItem

> Part of [[Feature 10 - Shopping List]]

A line item on a [[ShoppingList]]. Tracks its source (why it was added) and handles purchase flow on checkout.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `list_item_id` | PK | |
| `list_id` | FK → [[ShoppingList]] | |
| `product_id` | FK → [[Product]] | |
| `quantity_needed` | numeric | |
| `unit` | text | |
| `source_type` | enum | manual \| low_stock \| recipe \| meal_plan |
| `source_inventory_item_id` | FK → [[InventoryItem]] | Nullable — set when source_type = low_stock |
| `source_recipe_id` | FK → [[Recipe]] | Nullable — set when source_type = recipe |
| `source_batch_id` | FK → [[BatchEvent]] | Nullable — set when source_type = meal_plan |
| `is_checked` | bool | |
| `checked_by` | text FK → [[User]] | Nullable — Clerk user ID |
| `checked_at` | timestamp | Nullable |
| `unit_cost` | numeric | Nullable — captured at purchase |
| `notes` | text | |

> **Check constraint:** At most one of `source_inventory_item_id`, `source_recipe_id`, `source_batch_id` can be non-null. All three are null for manual adds.

## Source Types

| source_type | Source FK set | Trigger |
|-------------|--------------|---------|
| manual | — (all null) | User added it directly |
| low_stock | `source_inventory_item_id` → [[InventoryItem]] | Quantity dropped below `min_stock` |
| recipe | `source_recipe_id` → [[Recipe]] | "I want to make X, what do I need?" |
| meal_plan | `source_batch_id` → [[BatchEvent]] | Planned batch needs ingredients |

## Checkout Flow

When a user checks off an item:
1. System shows existing [[InventoryItem]]s for that [[Product]] within the [[Crew]] (with locations), plus "Create new"
2. If `source_type` = low_stock, pre-select the `source_inventory_item_id` item as the default
3. User confirms target → purchase [[Flow]] created, cached quantity updated
4. If creating new, user also picks `current_space_id`
5. `unit_cost` captured at time of purchase

## Key Decisions

- **Separate nullable FKs** replace the earlier polymorphic `source_ref_id` — gives real FK enforcement, clean joins, proper indexing
- Source tracking enables prioritization: low_stock items are essential, recipe items are plan-dependent
- **Always prompt** the user to choose which [[InventoryItem]] to restock or create new
- Checking off creates a purchase [[Flow]] in the ledger

## See Also

- [[Cost Data Flow]] — `unit_cost` captured at checkout
