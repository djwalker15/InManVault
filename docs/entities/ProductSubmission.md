# ProductSubmission

> Part of [[Feature 3 - Item Catalog]]

A request to promote a crew-private [[Product]] to the master catalog, or a system-generated flag when duplicate products are detected across [[Crew]]s. Reviewed by the InMan admin team.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `submission_id` | PK | |
| `product_id` | FK → [[Product]] | The crew-private Product being submitted |
| `submitted_by` | text FK → [[User]] | Clerk user ID of the person who submitted (null for auto-detected) |
| `crew_id` | FK → [[Crew]] | Which Crew the product originated from |
| `submission_type` | enum | `user_suggested` \| `auto_detected` |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `reviewed_by` | text FK → [[User]] | Nullable — InMan admin who reviewed |
| `reviewed_at` | timestamp | Nullable |
| `reviewer_notes` | text | Nullable — reason for rejection, merge notes, etc. |
| `duplicate_product_id` | FK → [[Product]] | Nullable — if reviewer identifies a master catalog duplicate to merge with |
| `created_at` | timestamp | |

## Submission Lifecycle

1. **Created:** A [[Crew]] member taps "Suggest for master catalog" on a custom product (`user_suggested`), or the system detects multiple Crews have created products with the same name/barcode (`auto_detected`).
2. **Pending:** Submission enters the InMan admin review queue.
3. **Review:** Admin examines the product data. System auto-flags potential duplicates in the master catalog (matching barcode or similar name+brand).
4. **Approved (promote):** Product's `crew_id` → null, `source` → `promoted`. All existing [[InventoryItem]]s, [[RecipeIngredient]]s, and [[ShoppingListItem]]s continue working — `product_id` doesn't change.
5. **Approved (merge):** Admin identifies an existing master catalog product that matches. All references to the submitted product are re-pointed to the existing master product. The duplicate crew-private product is soft-deleted. `duplicate_product_id` records which product it was merged into.
6. **Rejected:** Product stays crew-private. Reviewer adds notes explaining why.

## Duplicate Detection

During review, the system shows potential master catalog matches:
- **Barcode match:** Exact barcode match in master catalog → strong duplicate signal
- **Name + brand match:** Fuzzy match on name and brand → possible duplicate
- **Admin decides:** Promote as new, merge with existing, or reject

## Key Decisions

- **InMan admin team only** reviews and approves — centralized quality control for the master catalog
- Auto-detection threshold for `auto_detected` submissions is configurable (e.g., 3+ Crews with same barcode or similar name+brand)
- Merge capability ensures the master catalog stays clean with no duplicates
- Soft delete on merged products preserves audit trail

## Relationships

- References [[Product]] (the product being submitted)
- References [[Product]] as `duplicate_product_id` (the merge target, if applicable)
- References [[User]] (submitted_by, reviewed_by)
- References [[Crew]] (origin crew)
