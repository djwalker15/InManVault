# Feature 12 — Inventory Item Composition (Packages)

> **Status:** Break-wizard slice implemented (June 25, 2026) — ClickUp [86e1wd01b](https://app.clickup.com/t/86e1wd01b).
> This note is the **data-modeling design record**. The companion Claude Design session builds the UI on top of it. **Documentation propagation is complete** (entity notes, ERD, `docs/CLAUDE.md`, indexes — see [[#Implementation propagation checklist]]). The schema (3 tables, 2 flow types, `is_package`, cache arms, `open_package` RPC) and the **break wizard** (the [[Journey - Opening a Package]] open flow) are built; the **catalog-side composition editor** (mark-as-package toggle + `product_components` authoring UI) is the remaining follow-up — packages are seeded via SQL for now.

## Problem

Some inventory arrives as a **package** whose contents we want to track individually — the canonical case is a *variety pack* (12-pack = 4 Coke / 4 Sprite / 4 Fanta): we want to track the pack itself **and** each flavor inside, and drink a single Coke without the model falling over.

"Package" actually covers three shapes, all in scope for v1:

| Shape | Example | Modeled as |
|-------|---------|------------|
| **Variety / assortment pack** | 12-pack: 4 Coke / 4 Sprite / 4 Fanta | Multi-row composition (distinct child products) |
| **Multipack of identical units** | Case of 24 identical waters | **Single-row** composition (one child, quantity 24) — rides the same rails, no separate machinery |
| **Ad-hoc crew bundle** | Gift basket, meal kit | A crew-private package [[Product]] with components |

## Core model — "break on open", two real levels

A package break is the **inverse of a store-intent [[BatchEvent]]**: one input consumed, N outputs produced. We reuse InMan's existing patterns (BOM template at the catalog layer, atomic flows at the instance layer) rather than inventing new ones.

### Confirmed design decisions

1. **Both levels hold quantity; the package breaks on open** (not at purchase). A sealed pack is its own [[InventoryItem]] with quantity = number of sealed packs. **Opening** one converts package-units → child-units via flows. You can simultaneously have *2 sealed packs* + *3 loose Cokes* from a previously-opened pack, and every number is cache-consistent.
2. **Composition template lives on the [[Product]]** (catalog layer), like a recipe's ingredient list — a manufacturer's variety-pack composition is identical for every crew, so it is defined once. Ad-hoc bundles use a crew-private package Product with the same table.
3. **No per-physical-box contents table.** "Remaining composition" of an opened pack = the child [[InventoryItem]] levels. Consuming/wasting a child is just a normal `consumption`/`waste` [[Flow]] on the child item — **AC #2 satisfied with zero special machinery.**
4. **Cost: equal split with manual override at open time, conservation enforced** — the sum allocated to children equals the package's purchase cost × packs opened. (Satisfies "cost flows through everything.") The split rule is **category-aware** (a worked pressure-test surfaced that a flat "split by quantity" is undefined across mixed units):
   - **All components `count`** (variety packs, multipacks — the primary cases): split **per individual unit** → `$12 pack / 12 cans = $1.00/can`.
   - **Mixed weight/volume components** (e.g. a 50 g + 100 ml spice kit): you can't add `50 g + 100 ml`, so split **per component line** — reference-price-weighted when each child has a known cost, else equal-per-line — divided across that line's quantity for the child's unit cost.
   - Both paths are overridable at open time; the RPC **asserts the allocated total equals the package cost** regardless of method.
5. **Quantity-as-cache invariant preserved.** Every quantity change at both levels is a [[Flow]] row; reconciliation folds the new flow types in as signed deltas. **AC #3 satisfied.**

### Two layers

**Catalog layer — the BOM template (`product_components`):** defines what a package contains. Mutable + soft-deletable (catalog editors fix bad compositions). Visibility/RLS derived by joining to the package Product (no own `crew_id`).

```
product_components
  component_id        PK
  package_product_id  FK -> products      (the package)
  component_product_id FK -> products      (what's inside)
  quantity            numeric  (> 0)       (per single package)
  unit                FK -> unit_definitions
  sort_order          int
  created_at / updated_at / deleted_at
  unique (package_product_id, component_product_id) where deleted_at is null
```

Plus a convenience flag on `products`:
- `is_package boolean not null default false` — cheap filter for search/UI; true iff the product has active component rows. (App-maintained; could be a generated/derived check, but a stored flag avoids a join on every catalog search.)

> **v1 keeps components pointing at a specific [[Product]]** (`component_product_id`). A future extension could allow a [[ProductGroup]] reference for generic kits — parallels the [[RecipeIngredient]] product/group split. Out of scope now.

**Instance layer — no new table.** The package and every child are ordinary `inventory_items`. State is expressed entirely through quantities + flows.

### The "open package" operation — how it becomes Flows

Answers the open question *"how does opening/breaking a package translate into Flow rows?"*

A break event emits **one out-leg + N in-legs**, all in one transaction, all linked to an event header that mirrors [[BatchEvent]]:

```
package_break_events                 (immutable header — mirrors batch_events)
  break_event_id            PK
  crew_id                   FK -> crews
  package_inventory_item_id FK -> inventory_items   (the pack being opened)
  package_product_id        FK -> products          (denormalized convenience)
  quantity_opened           numeric (> 0)           (how many sealed packs broken)
  performed_by              text FK -> users
  performed_at / created_at

flow_package_break_details           (immutable child — links each leg flow to the event)
  flow_id              PK FK -> flows
  break_event_id       FK -> package_break_events
  role                 enum ('package' | 'component')
  component_product_id FK -> products   (null when role = 'package')
  allocated_unit_cost  numeric null     (the cost assigned to this leg)
  created_at
```

Two new `flow_type` enum values:

| New flow_type | Leg | Direction | Cache delta |
|---------------|-----|-----------|-------------|
| `package_break` | the package item | **out** | `- quantity` |
| `package_yield` | each child item | **in** | `+ quantity` |

> Naming is the working proposal — `package_break` / `package_yield`. Alternatives considered: reusing `consumption` + `batch_output` (rejected: semantically muddy, no way to distinguish package breaks in history, and no event linkage). A single detail-driven-sign type (rejected: two signs per event makes the cache trigger harder to reason about than two explicit types).

Both legs get a `flow_package_break_details` row, so every flow in the event links back to the header — exactly how `prep_usage` flows link to a batch via `flow_prep_usage_details.batch_id`. The quantity-cache trigger gets two new CASE arms (`package_break → −qty`, `package_yield → +qty`).

### Resolution at break time (the RPC)

`open_package(p_package_item_id, p_quantity_opened, p_target_space_id?, p_cost_overrides?)` — atomic plpgsql RPC, same shape as `record_purchase` / shopping checkout:

1. Insert `package_break_events` header.
2. Insert the **package-out** `package_break` flow (`quantity = quantity_opened`) + its detail (`role='package'`, full package cost recorded).
3. For each `product_components` row, compute child qty = `component.quantity × quantity_opened`. Then **resolve the child item** (mirrors batch store-output & checkout resolution):
   - find an existing active child `inventory_items` row for that product in the target space → **within-category unit-convert** to its unit, then insert a `package_yield` in-flow;
   - else **create** a new `inventory_items` row (defaulting to the package's `current_space_id` or `p_target_space_id`) and insert the in-flow.
   - Insert each in-leg's `flow_package_break_details` (`role='component'`, `component_product_id`, `allocated_unit_cost`) and update the child's `last_unit_cost`.
4. Cost allocation: default equal split of (package `last_unit_cost` × `quantity_opened`) across total child base-units; `p_cost_overrides` can replace per-child values; **assert the allocated total equals the package cost** (conservation).

## How this answers the task's open questions

| Open question | Answer |
|---------------|--------|
| Does the package hold quantity, or only children? | **Both.** Package holds quantity while sealed; children hold quantity once loose. Break converts one to the other. |
| How does opening translate to Flows? | One `package_break` out-leg on the pack + N `package_yield` in-legs on children, linked under a `package_break_events` header, written atomically by `open_package`. |
| Unit conversion when children differ in unit? | Each child carries its **own** unit; sibling legs are independent ledgers, so there's no sibling-to-sibling conversion. **Within-category** conversion only applies when merging an in-leg into a *pre-existing* child item in a different (same-category) unit. **Cross-category stays blocked**, same as today. |

## Edge cases & rules

- **Consume/waste a loose child:** ordinary `consumption` / `waste` flow on the child item. No package awareness needed.
- **Waste a *sealed* pack:** ordinary `waste` flow on the package item; cost = package cost. Works unchanged.
- **Partial / discarded contents:** `open_package` always materializes the **full** composition; any deviation (a damaged can) is a follow-up `waste` flow on that child. Keeps the break event a clean, conservation-respecting mirror of the BOM.
- **Re-seal / reverse a break:** out of scope for v1. If needed later, model as a reverse break event (children-out + package-in). Flag, don't build.
- **No clean undo of a break (v1 limitation):** because the break event and its flows are immutable, an erroneous open (wrong pack count) **cannot be reversed in v1** — recovery means wasting the spawned children and adjustment-restoring the package, which is clunky. The UI must therefore put a **clear confirm/preview step before committing a break** (count + resulting children + cost). This is the operational consequence of the reverse-break deferral above.
- **Immutability:** `package_break_events` and `flow_package_break_details` are **immutable** (created_at only), like all flow children and batch records.
- **Reconciliation:** the two new flow types are signed deltas in the existing per-item flow-sum reconciliation — no special-casing.

## New / changed entities (for the ERD + entity notes at implementation)

- **New:** `product_components`, `package_break_events`, `flow_package_break_details`.
- **New flow types:** `package_break`, `package_yield` (+ cache-trigger arms).
- **Changed:** `products` (+`is_package`); [[Product]] note (has-many components, is-package); [[InventoryItem]] note (can be a package; opening behavior); [[Flow]] note (two new types + child); [[Feature 3 - Item Catalog]] (composition templates) and this feature note.

## UI design hooks (for the companion design session)

The screens the design session needs to cover:
- **Catalog:** defining/editing a package's composition (add component rows: product + qty + unit); marking a product as a package; seeding master-catalog packages.
- **Add inventory:** buying a package = a normal purchase of the package item (sealed). No explosion yet.
- **Open / break package:** the core new screen — pick how many packs to open, preview the resulting child items (existing-item-merge vs create-new, target space), review/override cost allocation, confirm → atomic break.
- **Stock views:** show a package item with an "Open" action; show that loose children came from a package (via the break event / link) for traceability.
- **History:** a break event renders as one grouped entry (1 out + N in), like a batch.

## Implementation propagation checklist

**Documentation propagation — done (June 15, 2026 pass):**

- [x] Entity notes: new ([[ProductComponent]], [[PackageBreakEvent]], [[FlowPackageBreakDetail]]) + edits ([[Product]], [[InventoryItem]], [[Flow]]).
- [x] `docs/CLAUDE.md`: architecture decision #20 (Inventory Item Composition), `flow_type` table + enum/child-table list + cost pipeline + atomic-ops + RPC inventory + soft-delete/immutable lists.
- [x] `InMan_ERD.mermaid`: 3 entities + relationships, `is_package`, `flow_type` enum.
- [x] Index updates: [[InMan Data Model]] (entity TOC, feature list, decision), [[InMan User Journeys]] (status, dependency graph, entity-frequency); [[Cost Data Flow]]; [[Feature 3 - Item Catalog]]; [[Journey - Checking Stock]] "Open" action.
- [x] Journey [[Journey - Opening a Package]] fleshed out for UI design + implementation (catalog authoring, UI states, history, kiosk, microcopy, open questions).

**Schema — done (June 25, 2026):**

- [x] Migrations: `20260625120000_package_composition_enums.sql` (flow_type `package_break`/`package_yield` + `package_break_role`), `20260625120100_package_composition_slice.sql` (`products.is_package`, `product_components`, `package_break_events`, `flow_package_break_details`, RLS + immutability triggers, cache-trigger arms), `20260625120200_open_package_rpc.sql` (the atomic `open_package` RPC).

**Frontend — done (break wizard):**

- [x] `app/src/routes/inventory/open.tsx` — 4-step break wizard (count → preview → cost → confirm) reached from the "Open" action on a package item in [[Journey - Checking Stock]] (`row-actions.tsx`), route `/inventory/open/:itemId`. `app/src/lib/units.ts` provides the within-category preview conversion. Demo 12-pack seeded in `supabase/seed.sql`.

**Frontend — done (package authoring, fast path):**

- [x] `app/src/routes/inventory/add/package.tsx` (route `/inventory/add/package`, an add-method card) — create a crew-private package Product + its composition (`CompositionEditor` + `ProductPicker` under `app/src/components/inventory/package/`) + initial sealed stock in one go, then jump straight into the break wizard. Lets a package be authored and opened without seeding.

**Still pending (follow-up):**

- [ ] Composition editing on an **existing** Product — a "This is a package" toggle + `product_components` add/edit/soft-delete on a Product detail screen (there is no Product-detail screen yet). The create flow above only authors *new* package products.

## Dependencies

- [[Feature 3 - Item Catalog]] — composition templates live on [[Product]]
- [[Feature 7 - In-Out Flows]] — break/yield are new [[Flow]] types
- [[Feature 9 - Batching and Prepping]] — the break operation is the structural inverse of a store-intent [[BatchEvent]]; reuses its resolution + atomicity patterns
