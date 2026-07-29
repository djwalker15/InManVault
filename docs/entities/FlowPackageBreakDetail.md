# FlowPackageBreakDetail

> Child table of [[Flow]] when `flow_type` = `package_break` **or** `package_yield`

Package-break-specific fields for the legs of a [[PackageBreakEvent]]. Every leg of a break — the single `package_break` out-leg on the pack and each `package_yield` in-leg on a child — gets exactly one FlowPackageBreakDetail row, linking it back to the event header. This is how a break's flows group together in history, exactly as `prep_usage` flows link to a [[BatchEvent]] via [[FlowPrepUsageDetail]].

> **One child table, two flow types, discriminated by `role`.** Unlike the other [[Flow]] children (one table per `flow_type`), the two new break flow types share this single child and use the `role` enum to tell the package out-leg apart from the component in-legs. Both types always carry a child row — there is no childless break leg.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `flow_id` | FK → [[Flow]] | PK — one-to-one with parent |
| `break_event_id` | FK → [[PackageBreakEvent]] | The break this leg belongs to |
| `role` | enum | `package` (the out-leg) \| `component` (a child in-leg) |
| `component_product_id` | FK → [[Product]] | The child product — **null when `role = 'package'`** |
| `allocated_unit_cost` | numeric | Nullable — cost assigned to this leg (package cost on the out-leg; allocated per-unit child cost on each in-leg) |
| `created_at` | timestamp | |

## Behavior

- **Immutable** — `created_at` only. Never modified or deleted after creation.
- **Cost linkage.** On the `package` leg, `allocated_unit_cost` records the package's cost being released; on each `component` leg it records the per-unit cost allocated to that child, which also becomes the child [[InventoryItem]]'s `last_unit_cost`. The RPC **asserts conservation** — the sum allocated across `component` legs equals the package cost × `quantity_opened`. See [[Feature 12 - Inventory Item Composition]] §Cost and [[Cost Data Flow]].
- **Reconciliation.** The two parent flow types are ordinary signed deltas in the per-item flow-sum reconciliation (`package_break` = −qty on the pack, `package_yield` = +qty on the child) — no special-casing.
- Generated automatically by the `open_package` RPC — one row per leg, within the same transaction as the [[PackageBreakEvent]] header.

## Relationships

- One-to-one child of [[Flow]] (when `flow_type` is `package_break` or `package_yield`)
- References [[PackageBreakEvent]] via `break_event_id`
- References the child [[Product]] via `component_product_id` (component legs only)

## See Also

- [[Flow]] — parent entity (two new types: `package_break`, `package_yield`)
- [[PackageBreakEvent]] — the event header this leg links to
- [[FlowPrepUsageDetail]] — the analogous leg-to-event link for batches
- [[Cost Data Flow]] — package cost allocation to children
- [[Journey - Opening a Package]] — the flow that writes these rows
