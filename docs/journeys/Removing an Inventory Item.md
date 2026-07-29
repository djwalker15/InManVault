# User Journey: Removing an Inventory Item

> Covers taking an item out of active inventory tracking (soft delete)
> Referenced by [[InMan User Journeys]] #28

---

## Overview

Removing an item ends its life in active inventory without touching its history — the [[Flow]] ledger, [[WasteEvent]]s, and cost data all keep referencing it. This is for "we no longer stock this" / "this was added by mistake" cases; actual losses go through [[Journey - Logging Waste]] and consumption through the Use action ([[Journey - Checking Stock]]).

Shipped 2026-07 as the `soft_delete_inventory_item` RPC + the **Remove** inline action in [[Journey - Checking Stock]].

## Flow

1. Entry point: **Remove** inline action on an expanded inventory row.
2. Confirm panel (two-step — the action button only opens the panel): copy states that history stays in the ledger, and — when quantity ≠ 0 — that the remaining quantity will be zeroed out with an adjustment. Optional reason field.
3. Confirm → `soft_delete_inventory_item(p_inventory_item_id, p_reason)`.

## Rules

- **Admin/owner only.** The RPC gates on `is_crew_admin_or_owner`, consistent with the `inventory_items_delete` RLS policy. Members see the RPC error.
- **RPC, not a direct update.** A client-side `UPDATE … SET deleted_at` trips the RLS SELECT-on-new-row trap (the SELECT policy filters `deleted_at IS NULL`). Same pattern as `cascade_soft_delete_spaces` — see [[CLAUDE]] §Superseded Guidance #3.
- **Ledger consistency (zero-out rule):** if the cached quantity ≠ 0, the RPC first writes a `physical_count` adjustment ([[Flow]] with `abs(quantity)` + [[FlowAdjustmentDetail]] expected→0, reason defaulting to "Item removed from tracking"), so the item's flow sum is 0 at deletion and reconciliation never flags the tombstone.
- **History untouched:** flows are immutable and remain queryable for reporting/export.
- **No restore in v1** (consistent with space deletion). A future `restore_inventory_item` RPC would clear `deleted_at` and bring the item back at quantity 0.

## Data Model Touchpoints

| Entity | Operation |
|--------|-----------|
| [[InventoryItem]] | Update `deleted_at` (via RPC) |
| [[Flow]] + [[FlowAdjustmentDetail]] | Insert (zero-out adjustment, when quantity ≠ 0) |

## Related

- [[Journey - Checking Stock]] — entry point
- [[Journey - Space Reorganization]] — bulk item soft-delete via `delete_space_with_items`
- [[Journey - Logging Waste]] — for actual losses (cost-tracked)
