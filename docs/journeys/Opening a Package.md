# User Journey: Opening a Package (Break Composition)

> Covers breaking a sealed package [[InventoryItem]] into its child items — the inverse of a store-intent [[BatchEvent]]
> Referenced by [[InMan User Journeys]] #27
> Data-model spec: [[Feature 12 - Inventory Item Composition]]

---

## Overview

Some inventory arrives as a **package** whose contents are tracked individually — a variety pack (12-pack: 4 Coke / 4 Sprite / 4 Fanta), a multipack of identical units (case of 24 waters), or a crew-assembled bundle. Buying the package adds a **sealed** [[InventoryItem]] counted in packs. **Opening** a package is the moment it converts into its child items.

This journey is the **structural inverse of [[Journey - Prepping for Storage]]**: instead of consuming inputs to produce one output, it consumes **one input (the sealed pack)** to produce **N child outputs**. It reuses the same resolution (merge-into-existing vs create-new), atomicity, and derived-cost patterns. Everything happens through [[Flow]]s, so the [[InventoryItem]] quantity-as-cache invariant holds at both levels.

> **Break on open, not at purchase.** A package is tracked as sealed stock until the user explicitly opens it. You can hold *2 sealed packs* and *3 loose Cokes* (from a previously-opened pack) at the same time.

This note covers **two flows**: the **catalog side** (authoring a package's composition — a precondition) and the **instance side** (the break operation itself, Steps 1–5). Designers building the break screen can skip to [[#Entry Points]]; the authoring section exists so the loop is complete.

---

## Authoring a Package (Catalog Side)

Before any pack can be opened, *something* has to declare that a [[Product]] is a package and what it contains. This is a **catalog-management** task (part of [[Feature 3 - Item Catalog]]), not part of the break — composition lives on the [[Product]] via [[ProductComponent]] rows, defined once and shared by every crew for master-catalog packages.

### Who authors, and where

| Author | Surface | Scope |
|--------|---------|-------|
| **InMan admin / curator** | Master-catalog tooling (seeding) | Global packages (`crew_id` null on the package [[Product]]) — e.g. a real 12-pack SKU |
| **Crew member** (inventory-mutate permission) | Product detail → "Composition" panel | A crew-private package [[Product]] for ad-hoc bundles (gift basket, meal kit) |

Reached from the [[Product]] detail/edit screen via a **"This is a package"** toggle (`is_package`), which reveals a composition editor. Also reachable inline from [[Journey - Adding Inventory]] when creating a custom product the user marks as a package.

### Composition editor

```
☑ This product is a package
Contents (per single package):

  #   Component product        Qty    Unit
  1   Coke 12oz can            4      count    [edit] [✕]
  2   Sprite 12oz can          4      count    [edit] [✕]
  3   Fanta 12oz can           4      count    [edit] [✕]
  + Add component
```

- **Each row** = one [[ProductComponent]]: a child [[Product]] (typeahead search over the catalog + "create new product"), a **quantity > 0**, and a **unit** (from [[UnitDefinition]]). `sort_order` follows row order (drag to reorder).
- **Quantities are per single package** — the break multiplies by packs opened.
- **Multipack shortcut:** a single row with `quantity = 24` models a case of identical units. No separate UI.
- **Edits are live and soft** — removing a row soft-deletes the [[ProductComponent]]; editing a bad composition is expected (catalog editors fix mistakes). A past [[PackageBreakEvent]] is unaffected — it froze the composition it used.

### Validation

| Rule | Message |
|------|---------|
| Marking as a package with zero rows | "Add at least one component, or turn off 'This is a package.'" |
| `quantity ≤ 0` or empty | "Quantity must be greater than 0." |
| Child product = the package itself | "A package can't contain itself." |
| Duplicate child product | "{Product} is already a component — edit its quantity instead." (enforces the unique constraint) |
| Child is itself a package | Allowed, with an inline note: "Opening yields this as a sealed item — it won't break further." |

> **`is_package` is app-maintained.** Toggling it on requires ≥1 active component; removing the last component flips it back off. It's a stored flag (cheap catalog-search filter), not a live join — see [[Product]].

---

## Prerequisites

- The package [[InventoryItem]]'s [[Product]] is a package — `is_package = true` with at least one active `product_components` row.
- The package item has **quantity ≥ 1** (at least one sealed pack to open).
- No new permissions — any active crew member who can mutate inventory can open a package.

---

## Entry Points

| Entry point | Context |
|-------------|---------|
| **Checking Stock — item action** | A package item in [[Journey - Checking Stock]] surfaces an **"Open"** action alongside restock/move/waste. |
| **Package item detail** | The expanded detail of a package item shows its composition (from `product_components`) and an **"Open package"** button. |
| **After adding inventory (optional)** | After buying a package via [[Journey - Adding Inventory]], an optional "Open one now?" shortcut — for users who don't care to track the sealed unit. |

---

## Step 1 — Choose How Many to Open

A package item with 3 sealed packs:

```
Soda Variety 12-pack — 3 sealed
Each pack contains:  4 × Coke   4 × Sprite   4 × Fanta

How many to open?   [ 1 ]   (max 3)
```

- Default **1**. Stepper / numeric input, **bounded by the sealed quantity** (can't open more than you have).
- "Open all 3" shortcut.
- The preview below updates live as the count changes.

---

## Step 2 — Preview the Resulting Children

The composition is expanded by the count and each child is **resolved** — exactly like batch store-output and shopping checkout: either merge into an existing crew item or create a new one.

Opening **2** packs (8 Coke / 8 Sprite / 8 Fanta):

| Child | Qty produced | Resolves to | Target space |
|-------|-------------|-------------|--------------|
| Coke 12oz can | 8 count | **+ New item** | Kitchen > Fridge *(default)* |
| Sprite 12oz can | 8 count | **Merge** → existing (3 on hand → 11) | Kitchen > Fridge |
| Fanta 12oz can | 8 count | **+ New item** | Kitchen > Fridge |

- **Default target space** = the package's `current_space_id`; overridable per child or for all.
- **Merge vs create:** if an active [[InventoryItem]] already exists for that child product in the target space, the default is to merge (add to it); otherwise a new item is created.
- **Within-category unit conversion on merge** is shown inline — e.g. a kit's `50 g` paprika merging into an item held in `oz` displays "50 g → 1.76 oz". See [[UnitDefinition]].
- **Cross-category block:** if merging would require a cross-category conversion (e.g. a `g` yield into a `ml` item), merge is disabled and the child **falls back to create-new** in its own unit, with a note. Same guard as everywhere else.

---

## Step 3 — Review Cost Allocation

The package's purchase cost is split across the children. **Conservation is enforced** — the allocated total always equals the package cost × packs opened. The default rule is category-aware (see [[Feature 12 - Inventory Item Composition]] §Cost):

**All-count packs (variety packs, multipacks)** — equal split per individual unit:

```
Package cost:   $12.00 / pack  ×  2 opened   =   $24.00 to allocate
Children:       24 cans  →  $1.00 / can  (equal split)

  Coke    8 × $1.00 = $8.00
  Sprite  8 × $1.00 = $8.00
  Fanta   8 × $1.00 = $8.00
  ─────────────────────────
  Total            $24.00  ✓ matches package cost
```

**Mixed weight/volume kits** — split per component line (reference-price-weighted if children have known costs, else equal-per-line), divided across each line's quantity.

- Each child's allocated unit cost is **editable**; the running total must reconcile to the package cost or the user can't proceed ("$24.00 of $24.00 allocated").
- The allocated unit cost becomes the child [[InventoryItem]]'s `last_unit_cost`, flowing downstream into waste costing and recipe costing.

---

## Step 4 — Confirm

A summary + explicit confirm. **This step matters: a break cannot be cleanly undone** (the event and its flows are immutable — see [[Feature 12 - Inventory Item Composition]] §Edge cases), so the resulting state is shown plainly before committing.

| | |
|---|---|
| Opening | 2 × Soda Variety 12-pack |
| Sealed remaining after | 1 pack |
| Children produced | 8 Coke (new), 8 Sprite (→ existing, 11 total), 8 Fanta (new) |
| Cost released | $24.00 → children |
| Stored in | Kitchen > Fridge |

User taps **"Open package."**

---

## Step 5 — Complete (atomic via `open_package` RPC)

All of the following is one transaction — all succeed or all roll back:

**Break event header:**
- [[PackageBreakEvent]] created — `package_inventory_item_id`, `package_product_id`, `quantity_opened`, `performed_by`.

**Package out-leg:**
- `package_break` [[Flow]] on the package item (`quantity = packs opened`) → cache trigger decrements sealed quantity.
- [[FlowPackageBreakDetail]] (`role = 'package'`) links it to the event and records the package cost.

**Child in-legs (one per component):**
- Resolve target item — **merge** into the existing [[InventoryItem]] (within-category unit-convert) or **create** a new one (defaulting to the package's current space).
- `package_yield` [[Flow]] on the child item → cache trigger increments its quantity.
- [[FlowPackageBreakDetail]] (`role = 'component'`, `component_product_id`, `allocated_unit_cost`) links it to the event.
- Child's `last_unit_cost` set from the allocated cost (a **separate cost path** from the purchase-cost trigger).

### Success

Toast: "Opened 2 packs — 24 items added." The opened children appear in stock; the sealed package quantity drops by the count opened.

---

## Screen-by-Screen UI States

The break is a **4-step wizard** (count → preview → cost → confirm), reusing patterns the app already has: the split-output table from [[Journey - Prepping for Storage]] Step 4 and the merge-vs-create resolution from shopping checkout / batch store-output. Each step needs its non-happy states designed.

| Step / surface | Loading | Empty / boundary | Error / disabled |
|----------------|---------|------------------|------------------|
| **Entry (Open action)** | — | Action **hidden** when the item isn't a package (`is_package = false`) | Action **disabled** with tooltip "No sealed packs to open" when `quantity = 0` |
| **Step 1 — count** | — | Max = sealed quantity; "Open all N" shortcut | Stepper clamps to `[1, sealed qty]`; can't submit 0 or > sealed |
| **Step 2 — preview** | Skeleton rows while resolving merge-vs-create per child | If composition has **one** component (multipack), show the single child cleanly | Per child: **cross-category merge** → merge disabled, badge "New item (unit mismatch)" with note; target-space picker required |
| **Step 3 — cost** | — | Package has **no `last_unit_cost`** → fields default to $0 with a "cost unknown" hint; user may still proceed | "Allocate the full $X to continue" — **Next disabled** until the running total reconciles to package cost × packs |
| **Step 4 — confirm** | — | — | Submit shows a spinner; **idempotent** — double-tap can't double-break |
| **Result** | — | Success toast + children appear in stock | Atomic failure → nothing committed, retry banner (see [[#Edge Cases & Variations]]) |

### Stale composition

If the package's [[ProductComponent]] rows were **edited or soft-deleted** after this pack was purchased, the preview is built from the **current active** composition (the catalog template is the source — there's no per-box snapshot until the break commits). Surface a quiet note when the composition was edited recently: "Composition was updated {date} — preview reflects the latest contents." This is a deliberate consequence of the catalog-layer template ([[Feature 12 - Inventory Item Composition]]).

### Concurrency

Two members opening the same package item race on its sealed quantity. The `open_package` RPC is atomic and decrements via the `package_break` [[Flow]], so the second commit either still has stock (proceeds) or fails the bound check (re-fetch, show "Only N sealed left"). No optimistic child rows are shown until the transaction returns.

---

## History & Traceability

A break must be legible after the fact — both as an event and as the origin of loose children.

- **Grouped event.** In activity feeds (the [[Journey - Checking Stock]] item-detail "recent activity", the [[Journey - Cost Reporting]] transaction log), a [[PackageBreakEvent]] renders as **one collapsible entry** — `1 package out + N children in` — exactly like a [[BatchEvent]]. Header: "Opened 2 × Soda Variety 12-pack → 24 items." Expanding shows each leg with its allocated cost.
- **Child provenance.** A loose child item's detail can link back to the break that produced it (via its `package_yield` [[Flow]] → [[FlowPackageBreakDetail]] → [[PackageBreakEvent]]): "Came from: Soda Variety 12-pack (opened Jun 14)." Useful for "where did these 8 Cokes come from?" Merged children may have multiple such sources over time — show the most recent, with a count.
- **Package item after opening.** Its activity shows the `package_break` out-legs; its quantity reflects remaining sealed packs.

---

## Kiosk

**Opening a package is not one of the nine v1 kiosk actions** ([[Journey - Kiosk Daily Use]]). The break carries cost-allocation decisions and an irreversible confirm that don't fit the simplified, touch-first, Premises-scoped kiosk model. A sealed pack can still be **wasted** or **moved** at a kiosk (ordinary actions on the package item); it just can't be broken there. Flag as a possible future kiosk action — don't build it in v1.

---

## Edge Cases & Variations

| Situation | Handling |
|-----------|----------|
| **Open all remaining** | Sealed quantity goes to 0; the package item stays (soft-delete only if the user removes it). |
| **Consume / waste a loose child afterward** | Ordinary `consumption` / `waste` [[Flow]] on the child item — no package awareness. "Remaining composition" = current child levels. |
| **Waste a *sealed* pack** | Ordinary `waste` [[Flow]] on the package item at pack cost — does **not** spawn child items. |
| **Damaged contents (a crushed can)** | The break always materializes the **full** composition; a damaged unit is a follow-up `waste` [[Flow]] on that child. |
| **Cross-category merge** | Merge disabled; child falls back to create-new in its own unit (Step 2). |
| **Opened the wrong count** | No clean undo in v1 — recovery is wasting the spawned children + adjustment-restoring the package. The Step 4 confirm exists to prevent this. |
| **Atomic failure mid-break** | `open_package` is one transaction — any failure rolls back the entire event (header + all legs). The user sees a retry banner; no children are created and the sealed count is unchanged. |
| **Stale / edited composition** | Preview and break use the **current** active [[ProductComponent]] rows; a recent edit is surfaced with a note (see [[#Stale composition]]). |
| **Package with unknown cost** | If the package item has no `last_unit_cost`, cost allocation defaults to $0; conservation still holds ($0 of $0). |

---

## Microcopy & Validation

Working strings for the design session — tune for voice, but the **constraints** are load-bearing.

| Surface | Copy |
|---------|------|
| Entry action label | **Open** (package items only) |
| Step 1 prompt | "How many to open?" · shortcut "Open all {N}" |
| Step 2 merge badge | "Merge → {item} ({onhand} → {new total})" |
| Step 2 create badge | "+ New item · {space}" |
| Step 2 conversion note | "{qty} {fromUnit} → {converted} {toUnit}" |
| Step 2 cross-category note | "Different unit type — kept as a new {unit} item." |
| Step 3 reconcile hint | "{allocated} of {total} allocated" · blocks Next until equal |
| Step 4 primary button | **Open package** |
| Confirm caution | "This can't be undone — opened packs convert to loose items." |
| Success toast | "Opened {N} pack(s) — {M} items added." |
| Failure banner | "Couldn't open the package. Nothing was changed. Try again." |
| Entry disabled tooltip | "No sealed packs to open." |

**Hard validation gates:** count ∈ `[1, sealed qty]`; every child has a target [[Space]]; cross-category merges fall back to create-new (never silently mis-convert); allocated cost total **must equal** package cost × packs opened before Step 4 unlocks.

---

## Accessibility & Responsive

- **Wizard, not modal-stack.** On mobile the four steps are full-screen with a persistent footer (Back / Next, sticky CTA per the design system). On desktop, steps 2–3 can share a two-pane layout (preview left, cost right).
- The cost reconciliation total is an **`aria-live` region** — announce "{allocated} of {total} allocated" as values change so the blocked-Next state is non-visual-accessible.
- Per-child merge/create and space pickers are reachable and labeled by child product name (not row index).
- Preview and cost tables collapse to stacked cards under the `sm` breakpoint; the running total stays pinned.
- One-emoji rule still applies — no celebratory emoji on the break (this isn't the "pantry is live" moment).

---

## Open Design Questions

For the companion Claude Design session to resolve:

1. **Open action placement** — inline action in the [[Journey - Checking Stock]] expansion vs. only in the package item detail? (Spec lists both entry points — confirm the primary.)
2. **Provenance affordance** — how prominent is "came from a package" on a loose child? A quiet line vs. a tappable chip vs. nothing in v1.
3. **Cost editing affordance** — inline-editable cells in Step 3 vs. an "Adjust split" sub-step; how to present the category-aware default before any override.
4. **Multipack collapse** — single-component packs (case of 24) could skip Step 2's table for a one-line summary. Worth a distinct compact layout?
5. **"Open one now?" shortcut** — the optional post-add entry point ([[#Entry Points]]): keep in v1 or defer to reduce surface area?

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[Product]] | Read (`is_package`); Update (`is_package`) | Determining composition; toggling package status (authoring) |
| [[ProductComponent]] | Insert/Update/soft-delete (authoring); Read (break) | Defining/editing composition; expanding it at break time |
| [[InventoryItem]] | Read (package), Insert/Update (children) | Resolving merge-vs-create targets |
| [[PackageBreakEvent]] | Insert | The break event header |
| [[Flow]] | Insert (`package_break` ×1, `package_yield` ×N) | Package out-leg + child in-legs |
| [[FlowPackageBreakDetail]] | Insert (one per leg) | Links every leg to the event + cost allocation |
| [[Space]] | Read | Target space for children |
| [[UnitDefinition]] | Read | Within-category conversion on merge |

---

## Relationship to Prepping for Storage

| Aspect | Prepping for Storage (#12) | Opening a Package (#27) |
|--------|----------------------------|--------------------------|
| Direction | Assembly — N inputs → 1 output | Disassembly — 1 input → N outputs |
| Driven by | [[Recipe]] + [[RecipeVersion]] | `product_components` (catalog BOM) |
| Event | [[BatchEvent]] | [[PackageBreakEvent]] |
| Input flows | `prep_usage` (out) | `package_break` (out, the pack) |
| Output flows | `purchase` (in, derived cost) | `package_yield` (in, allocated cost) |
| Cost direction | Ingredients → output unit cost | Package cost → split across children |
| Output resolution | Create new item(s) per portion | Merge-into-existing or create-new per child |

---

## See Also

- [[Feature 12 - Inventory Item Composition]] — the data-model design record (entities, flow types, RPC, cost rule)
- [[ProductComponent]] · [[PackageBreakEvent]] · [[FlowPackageBreakDetail]] — the entity notes for the new tables
- [[Feature 3 - Item Catalog]] — where composition templates (the catalog side) live
- [[Journey - Prepping for Storage]] — the structural inverse (store-intent batch)
- [[Journey - Adding Inventory]] — buying a package adds it as sealed stock
- [[Journey - Checking Stock]] — the "Open" action entry point
- [[Journey - Logging Waste]] — wasting a sealed pack or a loose child
- [[Cost Data Flow]] — allocated child cost flows downstream to waste and recipe costing
