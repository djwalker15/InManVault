# ProductGroup

> Part of [[Feature 3 - Item Catalog]], [[Feature 8 - Recipes]]

A generic product concept that groups specific [[Product]]s underneath it. Represents "sugar" as a concept rather than "Domino Pure Cane Sugar, 4 lb" as a specific purchasable item.

ProductGroups solve the recipe abstraction gap: recipes naturally call for generic ingredients ("sugar", "olive oil") while inventory tracks specific products. A [[RecipeIngredient]] can reference a ProductGroup, and at batch time the system resolves to whichever specific [[InventoryItem]] the [[Crew]] has in stock.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `product_group_id` | PK | |
| `name` | text | Generic name (e.g., "Sugar", "Olive Oil", "Chicken Breast") |
| `default_category_id` | FK → [[Category]] | |
| `image_url` | text | Nullable — generic image for the group |
| `description` | text | Nullable |
| `crew_id` | FK → [[Crew]] | Nullable — null = global, set = crew-created |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Population Strategy

Three layers, same as [[Product]] catalog:

| Source | `crew_id` | How |
|--------|-----------|-----|
| Pre-seeded | null (global) | Bulk import from Open Food Facts categories or similar taxonomy |
| Admin-curated | null (global) | InMan team creates and maintains canonical groups |
| Crew-created | set (crew-private) | Crews create groups for their own use (e.g., "House Wine Red") |

## Relationship to Product

Specific [[Product]]s link to their group via `product_group_id` on the Product table. A Product can belong to at most one group. A ProductGroup can have many Products.

```
ProductGroup: Sugar
  ├── Product: Domino Pure Cane Sugar, 4 lb
  ├── Product: C&H Pure Cane Sugar, 4 lb
  └── Product: H-E-B Sugar, 5 lb

ProductGroup: Olive Oil
  ├── Product: Bertolli Extra Virgin, 16 oz
  └── Product: H-E-B Olive Oil, 32 oz
```

## Batch-Time Resolution

When a [[RecipeIngredient]] references a ProductGroup:
1. Find all [[Product]]s in the group (`product_group_id` = this group)
2. Find all [[InventoryItem]]s for those Products within the [[Crew]]
3. Prompt the user to choose which InventoryItem to deduct from, with FIFO suggestion (nearest expiry first)

## Key Decisions

- **Always exactly two levels:** ProductGroup → Product. No deeper nesting.
- **Not a Category.** Categories are broad ("Baking", "Condiments"). ProductGroups are specific ingredient types ("Sugar", "Olive Oil", "All-Purpose Flour").
- **[[Nullable crew_id Pattern]]** for global vs. crew-scoped groups.
- **Soft delete** via `deleted_at`.
- **A Product can exist without a group.** `product_group_id` on Product is nullable. Ungrouped products are still fully functional.

## Relationships

- Has many [[Product]]s (via `product_group_id` on Product)
- Has a default [[Category]]
- Optionally belongs to [[Crew]] (crew-created groups)
- Referenced by [[RecipeIngredient]] via `product_group_id`

## See Also

- [[Product]] — specific purchasable items that belong to a group
- [[RecipeIngredient]] — can reference a ProductGroup for generic ingredients
- [[Nullable crew_id Pattern]]
- [[Journey - Creating a Recipe]] — ProductGroup search during ingredient addition
