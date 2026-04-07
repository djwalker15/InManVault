# Product

> Part of [[Feature 3 - Item Catalog]]

A specific purchasable product. Lives outside any [[Crew]] (or optionally scoped to a [[Crew]] for custom products). This is the "what specific thing is this?" layer — brand, barcode, image, size.

Optionally belongs to a [[ProductGroup]] (the generic concept — e.g., "Sugar") via `product_group_id`.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `product_id` | PK | |
| `name` | text | |
| `brand` | text | |
| `barcode` | text | UPC/EAN |
| `image_url` | text | |
| `default_category_id` | FK → [[Category]] | |
| `size_value` | numeric | |
| `size_unit` | text | |
| `product_group_id` | FK → [[ProductGroup]] | Nullable — which generic group this product belongs to (e.g., Domino Sugar → "Sugar" group) |
| `source` | enum | `seeded` \| `barcode_api` \| `crew_created` \| `manual` \| `promoted` |
| `crew_id` | FK → [[Crew]] | Nullable — null = master catalog, populated = crew-private |
| `created_by` | text FK → [[User]] | Clerk user ID (null for seeded products) |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Source Field

Tracks how this Product entered the system:

| source | Meaning | crew_id |
|--------|---------|---------|
| `seeded` | Pre-loaded from Open Food Facts or similar open product database | null (master catalog) |
| `barcode_api` | Auto-created from barcode lookup API when scanned | null (master catalog) |
| `crew_created` | Created by a [[Crew]] member as a custom product | set (crew-private) |
| `manual` | Manually added by the InMan admin team | null (master catalog) |
| `promoted` | Started as crew-private, promoted to master catalog via [[ProductSubmission]] review | null (was set, now null) |

## Catalog Population Strategy

The master catalog is populated through five complementary mechanisms:

1. **Pre-seeded (day one):** Bulk import from Open Food Facts (2M+ products). `source` = `seeded`.
2. **Barcode lookup API (ongoing):** External API call on unrecognized barcode scan. `source` = `barcode_api`.
3. **Crew-created (ongoing):** Crews create custom products. `source` = `crew_created`.
4. **Manual curation (ongoing):** InMan admin team adds products. `source` = `manual`.
5. **Promotion (ongoing):** Crew-private products promoted via [[ProductSubmission]] review. `source` → `promoted`.

## Key Decisions

- **Shared master catalog** with crew-private custom products ([[Nullable crew_id Pattern]])
- **ProductGroup link is optional.** A Product can exist without belonging to a group. Ungrouped products are fully functional.
- **Barcode scanning** resolves to Product regardless of Crew
- **Promotion to master catalog** via [[ProductSubmission]] with merge capability
- **Soft delete** via `deleted_at`

## Relationships

- Optionally belongs to [[ProductGroup]] via `product_group_id`
- Has a default [[Category]]
- Referenced by [[InventoryItem]] via `product_id`
- Referenced by [[RecipeIngredient]] via `product_id`
- Referenced by [[ShoppingListItem]] via `product_id`
- Referenced by [[Recipe]] as `output_product_id`
- Referenced by [[ProductSubmission]] (as product being submitted, or merge target)

## See Also

- [[ProductGroup]] — generic product concept that groups specific Products
- [[Nullable crew_id Pattern]]
- [[ProductSubmission]] — promotion/review workflow
- [[Journey - Adding Inventory]] — where Products are searched and created
