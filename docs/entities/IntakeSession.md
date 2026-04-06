# IntakeSession

> Part of [[Feature 4 - Inventory Level Tracking]], [[Feature 7 - In-Out Flows]]

A session-based workflow for receiving multiple items at once — unpacking groceries, receiving a delivery, or logging items someone else brought home. The session itself is a persisted record for accountability and reporting ("who received the Sysco delivery on Tuesday?").

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `intake_session_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `source_type` | enum | `shopping_list` \| `manual` \| `purchase_order` (future) |
| `source_shopping_list_id` | FK → [[ShoppingList]] | Nullable — set when seeded from a completed shopping list |
| `source_reference` | text | Nullable — invoice number, PO number, delivery note. Placeholder for future purchase order integration. |
| `status` | enum | `in_progress` \| `completed` \| `cancelled` |
| `received_by` | text FK → [[User]] | Clerk user ID — who performed the intake |
| `total_items_expected` | integer | Nullable — only for list-seeded sessions. Count of expected items. |
| `total_items_received` | integer | Calculated on completion |
| `total_cost` | numeric | Calculated on completion — sum of received items where cost was entered |
| `notes` | text | Nullable — "H-E-B run March 30", "Sysco delivery #4821" |
| `started_at` | timestamp | |
| `completed_at` | timestamp | Nullable |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |

## Key Decisions

- **Session is a persisted record.** Tracks who received, when, what, and total cost. Important for commercial use (Haywire delivery accountability) and personal use (spending tracking).
- **Two processing modes:** Batch table (list-seeded, all expected items visible at once) and sequential (from-scratch, scan/search one at a time).
- **Purchase orders deferred.** `source_type` includes `purchase_order` as a future value. `source_reference` is a text field placeholder for invoice/PO numbers until a full vendor/PO system is modeled.
- **Completion is atomic.** Wrapped in a Supabase edge function — all purchase [[Flow]]s, [[InventoryItem]] updates/creations, and session finalization happen in one transaction.
- **Not soft-deleted.** IntakeSessions are historical records. Status can be `cancelled` but the record persists.

## Relationships

- Belongs to [[Crew]]
- Optionally seeded from [[ShoppingList]]
- Has many [[IntakeSessionItem]]s
- `received_by` references [[User]]
- Completion generates purchase [[Flow]]s for each received item

## See Also

- [[IntakeSessionItem]] — line items within the session
- [[Journey - Intake Session]] — the full user journey
- [[Journey - Shopping Trip]] — at-the-store checkout can seed an intake session
