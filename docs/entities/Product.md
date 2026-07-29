# Product

> Part of [[Feature 3 - Item Catalog]], [[Feature 12 - Inventory Item Composition]]

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
| `is_package` | boolean | Default `false`. True iff the product has active [[ProductComponent]] rows. App-maintained convenience flag — a cheap filter for search/UI that avoids a join on every catalog read. |
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

## Package Composition

A Product can be a **package** — a thing whose contents are tracked individually (a 12-pack of 4 Coke / 4 Sprite / 4 Fanta, a case of 24 identical waters, an ad-hoc crew bundle). Its bill of materials lives in [[ProductComponent]] rows (catalog layer, like a [[Recipe]]'s ingredient list — defined once, shared by every [[Crew]] for master-catalog packages). `is_package` mirrors "has at least one active component."

Buying a package adds a **sealed** [[InventoryItem]] counted in packs; **opening** one converts it into its child items via a [[PackageBreakEvent]]. See [[Feature 12 - Inventory Item Composition]] and [[Journey - Opening a Package]]. A child that is itself a package is not auto-exploded on break (no recursive break in v1).

## Key Decisions

- **Shared master catalog** with crew-private custom products ([[Nullable crew_id Pattern]])
- **`is_package` is a stored flag, not a live join.** App-maintained whenever components are added/removed — true iff active [[ProductComponent]] rows exist. Trades a tiny write-time cost for cheap catalog-search filtering.
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
- As a package: has many [[ProductComponent]] rows (via `package_product_id`); also referenced by [[ProductComponent]] as a child (`component_product_id`)
- Referenced by [[PackageBreakEvent]] as `package_product_id` and by [[FlowPackageBreakDetail]] as `component_product_id`

## See Also

- [[ProductGroup]] — generic product concept that groups specific Products
- [[Nullable crew_id Pattern]]
- [[ProductSubmission]] — promotion/review workflow
- [[Journey - Adding Inventory]] — where Products are searched and created
