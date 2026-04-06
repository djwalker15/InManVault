# Product

> Part of [[Feature 3 - Item Catalog]]

Universal product definition. Lives outside any [[Crew]] (or optionally scoped to a [[Crew]] for custom products). This is the "what is this thing?" layer — brand, barcode, image, size.

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

1. **Pre-seeded (day one):** Bulk import from Open Food Facts (2M+ products). Provides a useful catalog at launch. `source` = `seeded`.
2. **Barcode lookup API (ongoing):** When a barcode scan doesn't match the local catalog, the system calls an external API (Open Food Facts, UPCitemdb). If found, auto-creates a master catalog Product. `source` = `barcode_api`.
3. **Crew-created (ongoing):** Crews create custom products not in the catalog. These start as crew-private. `source` = `crew_created`.
4. **Manual curation (ongoing):** InMan admin team adds products directly. `source` = `manual`.
5. **Promotion (ongoing):** Crew-private products promoted to master catalog via [[ProductSubmission]] review (user-suggested or auto-detected duplicates). On approval, `crew_id` → null, `source` → `promoted`.

## Key Decisions

- **Shared master catalog:** Products like "Cholula Hot Sauce, 5 oz" exist once globally. Multiple [[Crew]]s reference the same Product via their own [[InventoryItem]]s.
- **Custom products:** [[Crew]]s can create products not in the master catalog. These have `crew_id` set and are only visible to that [[Crew]].
- **Barcode scanning:** A UPC resolves to a Product regardless of which [[Crew]] is scanning it. First checks local catalog, then external API.
- **Promotion to master catalog:** Via [[ProductSubmission]] — user-suggested or auto-detected, reviewed by InMan admin team only.
- **Merge on promotion:** If a duplicate master catalog product exists (same barcode), the admin can merge references rather than creating a duplicate.
- **Soft delete:** Uses `deleted_at`. Historical [[InventoryItem]]s, [[Flow]]s, and [[RecipeIngredient]]s can still reference deleted products.

## Relationships

- Has a default [[Category]]
- Referenced by [[InventoryItem]] via `product_id`
- Referenced by [[RecipeIngredient]] via `product_id`
- Referenced by [[ShoppingListItem]] via `product_id`
- Referenced by [[Recipe]] as `output_product_id`
- Referenced by [[ProductSubmission]] (as the product being submitted, or as a merge target)

## See Also

- [[Nullable crew_id Pattern]]
- [[ProductSubmission]] — the promotion/review workflow
- [[Journey - Adding Inventory]] — where Products are searched and created
