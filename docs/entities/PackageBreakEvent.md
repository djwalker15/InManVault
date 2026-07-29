# PackageBreakEvent

> Part of [[Feature 12 - Inventory Item Composition]]

The immutable header for **opening a sealed package** — the moment a package [[InventoryItem]] converts into its child items. It is the **structural inverse of a store-intent [[BatchEvent]]**: one input consumed (the pack), N outputs produced (the children). It mirrors `batch_events` and groups all the legs of a single break so history can render them as one entry.

A break emits **one out-leg + N in-legs** as [[Flow]]s, all written in one transaction by the `open_package` RPC, all linked back to this header via [[FlowPackageBreakDetail]].

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `break_event_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `package_inventory_item_id` | FK → [[InventoryItem]] | The sealed pack being opened |
| `package_product_id` | FK → [[Product]] | Denormalized convenience (the package product) |
| `quantity_opened` | numeric | **> 0** — how many sealed packs broken in this event |
| `performed_by` | text FK → [[User]] | Clerk user ID |
| `performed_at` | timestamp | |
| `created_at` | timestamp | |

## Behavior

- **Immutable** — `created_at` only, no `updated_at` / `deleted_at`. Like all flow children and batch records, a break event is never modified or deleted after creation.
- **Composition is frozen at break time.** The RPC reads the package [[Product]]'s active [[ProductComponent]] rows once; later edits to the template don't retro-change a past break.
- **No clean undo in v1.** Because the header and its flows are immutable, an erroneous open (wrong pack count) can't be reversed — recovery means wasting the spawned children and adjustment-restoring the package. This is why [[Journey - Opening a Package]] puts a **confirm/preview step** before committing. A reverse-break event (children-out + package-in) is deferred — flagged, not built.
- **`performed_by` persists after user account deletion.** Same pattern as [[Flow]] and [[BatchEvent]] — the deleted user's `users` row stays as a tombstone and `performed_by` keeps pointing at it. Audit and per-user analytics stay intact. See [[CLAUDE]] §"User Account Deletion."

## Relationships

- Belongs to [[Crew]]
- References the package [[InventoryItem]] being opened
- References the package [[Product]] (denormalized)
- References [[User]] as `performed_by`
- Has many [[FlowPackageBreakDetail]] rows — one per leg (1 `package` + N `component`), each linking a [[Flow]] to this event
- Mirrors [[BatchEvent]] (the inverse store-intent batch)

## See Also

- [[Feature 12 - Inventory Item Composition]] — the design record
- [[FlowPackageBreakDetail]] — the child rows that link each leg flow to this header
- [[Flow]] — `package_break` (out) + `package_yield` (in) legs
- [[ProductComponent]] — the catalog BOM the break expands
- [[BatchEvent]] — the structural inverse (assembly vs. disassembly)
- [[Journey - Opening a Package]] — the user-facing flow
- [[Cost Data Flow]] — the package cost is split across children at break time
