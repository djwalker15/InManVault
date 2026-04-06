# BatchOutput

> Part of [[Feature 9 - Batching and Prepping]]

What was produced by a [[BatchEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `batch_output_id` | PK | |
| `batch_id` | FK → [[BatchEvent]] | |
| `inventory_item_id` | FK → [[InventoryItem]] | Nullable — null for consumed output |
| `quantity_produced` | numeric | |
| `unit` | text | |
| `was_consumed` | bool | True if eaten/used immediately, false if stored |

## Behavior

- For store/split intent: `was_consumed` = false rows create or restock [[InventoryItem]]s with recipe-derived cost
- For consume intent: `was_consumed` = true and `inventory_item_id` is null — cost still tracked on the [[BatchEvent]]
