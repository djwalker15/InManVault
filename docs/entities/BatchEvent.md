# BatchEvent

> Part of [[Feature 9 - Batching and Prepping]]

The execution of a [[Recipe]]. A batch consumes [[InventoryItem]]s (inputs) and optionally produces new [[InventoryItem]]s (outputs). Supports real-time tracking and after-the-fact logging.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `batch_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `recipe_version_id` | FK → [[RecipeVersion]] | |
| `batch_intent` | enum | store \| consume \| split |
| `scale_factor` | numeric | |
| `expected_yield` | numeric | |
| `actual_yield` | numeric | |
| `yield_unit` | text | |
| `status` | enum | planned \| in_progress \| completed \| cancelled |
| `output_space_id` | FK → [[Space]] | Nullable — where stored output goes |
| `output_expiry_date` | date | Nullable |
| `total_cost` | numeric | Calculated from consumed inputs |
| `performed_by` | text FK → [[User]] | Clerk user ID |
| `started_at` | timestamp | |
| `completed_at` | timestamp | |
| `notes` | text | |

## Batch Intents

| Intent | Ingredients | Output | Cost Tracked? | Requires output_product_id on [[Recipe]]? |
|--------|-------------|--------|--------------|------------------------------------------|
| store | Deducted | Creates/restocks [[InventoryItem]]s | Yes — on items | **Yes** |
| consume | Deducted | Nothing enters inventory (eaten) | Yes — on BatchEvent | No |
| split | Deducted | Some stored, some consumed | Yes — both | **Yes** (for stored portion) |

If `batch_intent` is store or split and the [[Recipe]]'s `output_product_id` is null, the app layer blocks the batch.

## Key Decisions

- Real-time workflow: `status` progresses planned → in_progress → completed
- After-the-fact logging: create with status = completed directly
- Cost flows through: ingredient costs → batch total_cost → derived cost on stored output [[InventoryItem]]s
- Actual yield vs. expected yield tracked — useful for recipe accuracy over time
- **Immutable record** — BatchEvents are never modified or deleted after creation (status updates are the only allowed mutation)
- **Batch completion is atomic** — implemented as a Supabase edge function wrapping a database transaction. Either all steps succeed (deductions, flows, output creation) or all roll back.

## Relationships

- Belongs to [[Crew]]
- References [[RecipeVersion]]
- Has many [[BatchInput]]s
- Has many [[BatchOutput]]s
- Completion generates prep_usage [[Flow]]s (outflows for inputs) and purchase-like [[Flow]]s (inflows for stored outputs)
- Referenced by [[WastePrepFailureDetail]]
- Referenced by [[ShoppingListItem]] as `source_batch_id`

## See Also

- [[Cost Data Flow]] — batch costing is step 3 in the cost pipeline
