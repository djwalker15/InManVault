# BatchInput

> Part of [[Feature 9 - Batching and Prepping]]

An ingredient actually consumed during a [[BatchEvent]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `batch_input_id` | PK | |
| `batch_id` | FK → [[BatchEvent]] | |
| `inventory_item_id` | FK → [[InventoryItem]] | |
| `quantity_used` | numeric | |
| `unit` | text | |

## Behavior

Each BatchInput generates a prep_usage [[Flow]] on batch completion, deducting from the referenced [[InventoryItem]].
