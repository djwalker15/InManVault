# User Journey: Moving Items

> Covers all scenarios for changing where items are and where they belong
> Referenced by [[InMan User Journeys]] #5

---

## Overview

Moving Items is about changing locations — both `current_space_id` (where an item actually is right now) and `home_space_id` (where it's supposed to live). Every physical move generates a transfer [[Flow]] for the movement history ledger. Setting or changing a home location is metadata only (no Flow).

Five scenarios, ranging from a single item move to a full kitchen reorganization:

1. **Single item move** — one item, new location
2. **Put-back routine** — batch-process all displaced items back to their homes
3. **Set home locations** — batch-assign homes for unsorted items
4. **Bulk reassign** — move everything from one [[Space]] to another with preview
5. **Reorganize** — free-form redistribution across multiple spaces

---

## Entry Points

| Entry Point | Typical Scenario |
|-------------|-----------------|
| **Checking Stock inline actions** | Move, Put Back, Set Home on a specific item |
| **Spaces page** | Space-centric: select a Space, see items, move them out or in |
| **Inventory page** | Item-centric: multi-select items, pick destination(s) |
| **Dashboard alerts** | "Put Things Back" (displaced count) or "Shelve Unsorted" |
| **Kiosk mode** | Put-back routine as an allowed action for bar staff |

---

## Scenario 1 — Single Item Move

The simplest case: one item, new location.

**Trigger:** "Move" inline action from [[Journey - Checking Stock]], or tap an item anywhere and select "Move."

### Flow

1. Item shown with its current location path (e.g., "Kitchen > Back > Above > Cabinet 1")
2. [[Space]] tree dropdown to pick the new `current_space_id`
3. Confirm

### On Confirm

- `current_space_id` updated on [[InventoryItem]]
- Transfer [[Flow]] created **immediately** (`flow_type` = transfer, `from_space_id` = old location, `to_space_id` = new location, `performed_by` = current [[User]])
- Displacement status updates automatically:
  - New location matches `home_space_id` → status becomes **In Place**
  - New location differs from `home_space_id` → status becomes/stays **Displaced**
  - `home_space_id` is null → status stays **Unsorted**
- Success toast: "Moved [item name] to [new location path]"

### Data Touched

- [[InventoryItem]] (update `current_space_id`)
- [[Flow]] (insert — transfer, immediate)

---

## Scenario 2 — Put-Back Routine

End-of-day workflow: batch-process all displaced items back to their home locations. Critical for commercial environments like Haywire where items get moved during service and need to be reset.

**Trigger:** "Put Things Back" from:
- Dashboard alerts widget (displaced count badge)
- Inventory page toolbar
- [[KioskSession]] (if put-back is an allowed action)

### Step 1 — Displaced Items List

System shows all [[InventoryItem]]s where `home_space_id` ≠ `current_space_id` (both non-null):

| Item | Currently At | Home Is | Action |
|------|-------------|---------|--------|
| Cholula Hot Sauce | Countertop | Pantry > Shelf 2 | ☐ Put back |
| Olive Oil | Countertop | Back > Above > Cabinet 1 | ☐ Put back |
| Tony Chachere's | Island | Pantry > Shelf 4 | ☐ Put back |

Each row has a checkbox. **"Select All"** at the top for quick batch processing.

### Step 2 — Confirm

User checks the items they've actually put back (maybe the olive oil stays out on purpose). Taps "Confirm put-back."

### On Confirm (atomic via edge function)

- For each checked item: `current_space_id` = `home_space_id`, transfer [[Flow]] created
- Unchecked items stay displaced — no change
- All Flows batched in one transaction
- Summary toast: "3 items put back. 1 still displaced."

### Data Touched

- [[InventoryItem]] (update `current_space_id` per checked item)
- [[Flow]] (insert — one transfer per checked item, batched atomically)

---

## Scenario 3 — Set Home Locations (Batch)

Assign `home_space_id` to unsorted items — items that have a current location but no designated home. Common after an [[Journey - Intake Session]] where shelving was deferred, or after initial inventory setup.

**Trigger:** "Shelve Unsorted Items" from:
- Dashboard alerts (unsorted count)
- Inventory page with stock status filter = Unsorted

### Step 1 — Unsorted Items List

System shows all [[InventoryItem]]s where `home_space_id` is null:

| Item | Currently At | Set Home To |
|------|-------------|-------------|
| Cholula Hot Sauce | Kitchen (Premises) | [Space dropdown] |
| New Spice Blend | Kitchen (Premises) | [Space dropdown] |
| Jasmine Rice | Kitchen (Premises) | [Space dropdown] |

Each row has a [[Space]] tree dropdown for assigning `home_space_id`.

**Shortcut:** "Same as current" button per row — sets `home_space_id` = `current_space_id` (item is already where it belongs).

### Step 2 — Confirm

User reviews assignments, taps "Save home locations."

### On Confirm

- `home_space_id` updated on each item where a home was assigned
- **No Flows generated** — setting a home isn't a physical movement, it's a classification
- Items not assigned stay unsorted — no change
- Summary toast: "Home set for 5 items. 2 still unsorted."

### Data Touched

- [[InventoryItem]] (update `home_space_id` per assigned item)
- No [[Flow]]s — metadata only

---

## Scenario 4 — Bulk Reassign (Space to Space)

Move everything from one [[Space]] to another. "We moved all the spices from Cabinet 1 to Cabinet 3."

**Trigger:** From Spaces page — select a Space, click "Move all items from here." Or from inventory page with Space filter applied — "Move all to..."

### Step 1 — Select Source and Destination

- **Source Space** — pre-filled if triggered from Spaces page, or picked from tree dropdown
- **Destination Space** — tree dropdown (source and its descendants excluded to prevent circular moves)
- **Scope toggle:** "Items in this space only" vs. "Items in this space and all children"

### Step 2 — Preview

System shows exactly what will change **before committing**:

| Item | Current Location | Will Move To | Home Update? |
|------|-----------------|-------------|-------------|
| Cayenne Pepper | Cabinet 1 | Cabinet 3 | Home: Cabinet 1 → Cabinet 3 |
| Paprika | Cabinet 1 | Cabinet 3 | Home: Cabinet 1 → Cabinet 3 |
| Spice Rack (container) | Cabinet 1 | Cabinet 3 | Home: Cabinet 1 → Cabinet 3 |

**Home update logic:** For each item, if `home_space_id` equals the source Space (or any child of the source when scope includes children), `home_space_id` will also update to the corresponding destination. Items whose home is elsewhere are unaffected.

**Per-item controls:**
- Uncheck to exclude individual items from the move
- Toggle home update per item: "Update home too" vs. "Keep original home"

### Step 3 — Confirm

User reviews the preview, taps "Move [N] items."

### On Confirm (atomic via edge function)

- For each included item: `current_space_id` updated, transfer [[Flow]] created
- For items with home update enabled: `home_space_id` also updated
- All Flows batched in one transaction
- Summary toast: "Moved 8 items from Cabinet 1 to Cabinet 3. 8 home locations updated."

### Data Touched

- [[InventoryItem]] (update `current_space_id`, optionally `home_space_id`, per item)
- [[Flow]] (insert — one transfer per item, batched atomically)

---

## Scenario 5 — Reorganize

The most complex scenario: a kitchen rearrangement where many items need to go to many different destinations. Not a single source-to-destination bulk move — it's a free-form redistribution.

Two approaches available — user picks whichever fits their task:

### Approach A — Space-Centric ("I'm emptying Cabinet 1")

1. Select a source [[Space]] from the tree
2. See all items currently at that Space
3. For each item, pick a new destination from a [[Space]] tree dropdown (or leave in place)
4. Per-item toggle for updating `home_space_id`
5. Preview all changes
6. Confirm — batched atomically

Best for: "I'm clearing out this cabinet and putting things elsewhere."

### Approach B — Item-Centric ("I'm selecting items that need to move")

1. Open the inventory list (optionally filtered by [[Space]], [[Category]], or search)
2. Multi-select items using checkboxes
3. Two bulk actions:
   - **"Move all to..."** — single destination for all selected items (effectively becomes Scenario 4)
   - **"Assign individually"** — each selected item gets its own destination dropdown
4. Per-item toggle for updating `home_space_id`
5. Preview all changes
6. Confirm — batched atomically

Best for: "I'm picking specific items from different places and reorganizing them."

### Shared Behavior (Both Approaches)

- **Preview screen** showing every change: current → new for both `current_space_id` and `home_space_id`
- **Per-item toggle** for updating home location
- **Atomic edge function** for the commit — all or nothing
- **Transfer [[Flow]]s** generated for every item that actually moved (items left in place generate no Flow)
- Items can be removed from the change set before confirming

### Data Touched

- [[InventoryItem]] (update `current_space_id`, optionally `home_space_id`, per item)
- [[Flow]] (insert — one transfer per moved item, batched atomically)

---

## Flow Generation Rules

| Scenario | Flow Timing | Flow Count |
|----------|------------|------------|
| Single item move | **Immediate** — one Flow created on confirm | 1 |
| Put-back routine | **Batched** — all Flows in one transaction | 1 per checked item |
| Set home locations | **None** — no physical movement | 0 |
| Bulk reassign | **Batched** — all Flows in one transaction | 1 per moved item |
| Reorganize | **Batched** — all Flows in one transaction | 1 per moved item |

> **Rule:** Transfer Flows are only created when `current_space_id` changes. Changing `home_space_id` alone is metadata — no Flow.

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[InventoryItem]] | Read | Listing items, showing current/home locations, displacement status |
| [[InventoryItem]] | Update (`current_space_id`) | Every physical move (Scenarios 1, 2, 4, 5) |
| [[InventoryItem]] | Update (`home_space_id`) | Set home (Scenario 3), bulk reassign with home update (4), reorganize with home update (5) |
| [[Flow]] | Insert (transfer) | Every physical move. Immediate for single items, batched for bulk. |
| [[Space]] | Read | Tree dropdowns, source/destination selection, path display |

> **No new entities introduced.** All operations use existing [[InventoryItem]], [[Flow]], and [[Space]] tables.

---

## See Also

- [[Journey - Checking Stock]] — inline Move, Put Back, Set Home actions (single-item triggers for Scenarios 1, 2, 3)
- [[Journey - Intake Session]] — deferred shelving creates unsorted items that feed into Scenario 3
- [[Journey - Space Reorganization]] — journey #25 covers the Space hierarchy restructuring itself (renaming/moving/deleting Spaces). This journey covers moving the *items* within those Spaces.
- [[Feature 5 - Assignment and Location Tracing]] — the feature definition covering displacement states and movement history
