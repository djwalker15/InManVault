# Category

> Part of [[Feature 3 - Item Catalog]]

Categorization for products and inventory items. System defaults plus crew-custom categories.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `category_id` | PK | |
| `category_name` | text | |
| `description` | text | |
| `crew_id` | FK → [[Crew]] | Nullable — null = system default, populated = crew-custom |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Key Decisions

- System defaults (Dry Goods, Condiments, Snacks, etc.) are available to all [[Crew]]s
- [[Crew]]s can create custom categories (e.g., "Bar Garnishes" for Haywire)
- [[Product]]s carry a `default_category_id`, but each [[InventoryItem]] can override with its own `category_id`
- **Soft delete:** Uses `deleted_at`.

## Relationships

- Referenced by [[Product]] as `default_category_id`
- Referenced by [[InventoryItem]] as `category_id` (override)

## See Also

- [[Nullable crew_id Pattern]]
