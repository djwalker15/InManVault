# User Journey: Space Setup (First-Time)

> The detailed first-time experience for building out the physical hierarchy during onboarding
> Referenced by [[Journey - Onboarding]] Step 5

---

## Overview

Space setup is the most critical onboarding step. The hierarchy a user builds here determines how they organize inventory, trace item locations, log waste context, and scope kiosk actions. Getting it right the first time means users rarely need to restructure later.

The experience has five phases: **Explainer → Premises → Guided First Branch → Tree Editor Handoff → Template Option**.

---

## Phase 1 — The Explainer

Before any building starts, the user sees a dedicated "How Spaces Work" screen. This is a visual explainer showing the 7 levels using a relatable example (a kitchen):

```
My House (premises)
  └── Kitchen (area)
       └── Back Wall (zone)
            └── Above (section)
                 └── Cabinet 1 (sub_section) ← fixed, bolted to wall
                      └── Spice Rack (container) ← portable, removable
                           └── Shelf 1 (shelf)
```

Each level gets a one-line explanation. The **structural vs. portable** distinction between `sub_section` and `container` is called out visually. Key message: "Not every level is required — use as many or as few as your space needs."

### Behavior
- CTA: "Got it, let's build" → proceeds to Phase 2
- **Dismissable** — user can skip if they're confident
- **Accessible later** — a help icon ("?") in the space builder always brings the explainer back
- Also available from the Spaces page after onboarding via the same "?" icon

### Entities Involved
- None — this is purely educational UI

---

## Phase 2 — Create Your Premises

The first real input. Simple, focused screen: "What's the name of your place?"

- Text field with placeholder examples: "My House", "The Apartment", "Haywire Bar", "Lake House"
- The **live tree** appears alongside (side panel on desktop, below on mobile), currently empty
- When they confirm the name, the tree shows the first node

```
🏠 My House
```

Brief confirmation message: "This is the top of your hierarchy. Everything else lives inside it."

### Entities Involved
- [[Space]] (insert — unit_type = `premises`, parent_id = null, crew_id from current [[Crew]])

---

## Phase 3 — Guided First Branch

The system walks the user through one complete branch from premises to the deepest level they need. At each step:
- The **live tree grows** in real-time
- **Smart defaults** pre-select the most likely `unit_type` for the child, but the user can override via dropdown
- **Tooltips** explain each unit type in context
- **Prompts** ask whether to go **wider** (add siblings) or **deeper** (add children)

### Step 3a — Add an Area

**Prompt:** "What's the first room or area you want to organize?"

| Element | Value |
|---------|-------|
| Smart default | `area` |
| Tooltip | "Areas are rooms or functional spaces within your premises — Kitchen, Garage, Bar, Office." |
| Examples | Kitchen, Garage, Bar, Pantry Closet |

User types "Kitchen" → tree updates:

```
🏠 My House
  └── 🏷️ Kitchen
```

**Follow-up prompt:** "Want to add another area (like Garage), or go deeper into Kitchen?"
- **Add another area** → repeat Step 3a
- **Go deeper** → continue to Step 3b

### Step 3b — Add a Zone

**Prompt:** "Kitchen has different regions — what do you call the first one?"

| Element | Value |
|---------|-------|
| Smart default | `zone` |
| Tooltip | "Zones are named regions within an area. Think 'the back wall', 'the island', 'the pantry side'." |
| Examples | Back, Center, Side, Pantry, Fridge |

User types "Back" → tree updates:

```
🏠 My House
  └── 🏷️ Kitchen
       └── 📍 Back
```

**Follow-up prompt:** "Add another zone in Kitchen (like Center, Side, Pantry), or go deeper into Back?"

### Step 3c — Add a Section

**Prompt:** "Within Back, are there positions like above the counter, below the counter, the countertop itself?"

| Element | Value |
|---------|-------|
| Smart default | `section` |
| Tooltip | "Sections are positional subdivisions — above, below, top, front, back. They describe where within a zone something is." |
| Examples | Above, Below, Top, Front, Back |

User types "Above" → tree updates:

```
🏠 My House
  └── 🏷️ Kitchen
       └── 📍 Back
            └── 📐 Above
```

**Follow-up prompt:** "Add another section in Back (like Below, Top), or go deeper into Above?"

### Step 3d — Add a Sub-Section

**Prompt:** "What fixed storage is built into Back · Above? Cabinets, drawers, built-in shelving?"

| Element | Value |
|---------|-------|
| Smart default | `sub_section` |
| Tooltip | "Sub-sections are fixed infrastructure — things bolted to the wall or built into the room. Cabinets, drawers, built-in shelving units. You can't pick these up and move them." |
| Examples | Cabinet 1, Drawer 2, Built-in Wine Rack |

User types "Cabinet 1" → tree updates:

```
🏠 My House
  └── 🏷️ Kitchen
       └── 📍 Back
            └── 📐 Above
                 └── 🔩 Cabinet 1
```

**Follow-up prompt:** "Add another sub-section in Above (like Cabinet 2, Cabinet 3), or go deeper into Cabinet 1?"

### Step 3e — Add a Container (optional)

**Prompt:** "Inside Cabinet 1, do you have any removable organizers, bins, or racks? These are things you could pick up and move."

| Element | Value |
|---------|-------|
| Smart default | `container` |
| Tooltip | "Containers are portable storage — drawer organizers, spice racks, lazy susans, cambros, bins. Unlike sub-sections, you can pick these up and rearrange them." |
| Examples | Spice Rack, Lazy Susan, Drawer Organizer, Cambro |
| Skip option | "No removable storage here" → skip to Step 3f or end branch |

### Step 3f — Add a Shelf (optional)

**Prompt:** "Does this have individual shelves you want to track separately?"

| Element | Value |
|---------|-------|
| Smart default | `shelf` |
| Tooltip | "Shelves are the deepest level — individual shelf levels within a cabinet, rack, or container." |
| Examples | Shelf 1, Shelf 2, Top Shelf, Bottom Shelf |
| Skip option | "No individual shelves to track" → end branch |

### After the First Branch

The tree shows the complete first branch:

```
🏠 My House
  └── 🏷️ Kitchen
       └── 📍 Back
            └── 📐 Above
                 └── 🔩 Cabinet 1
                      └── 📦 Spice Rack
                           └── 📏 Shelf 1
```

Confirmation message: "Great — you've built your first branch! Now you can see how the hierarchy works. Keep going by adding more zones, sections, and storage to fill out your space."

### Entities Involved (all steps)
- [[Space]] (insert — one row per node added, with appropriate `unit_type`, `parent_id`, `crew_id`)

---

## Phase 4 — Handoff to Tree Editor

The UI transitions from the guided prompt-and-response mode to the **full tree editor**. The tree they've built is visible and interactive.

### Capabilities
- **Click any node** → add children (smart defaults for child type based on parent's unit_type)
- **"+" at any level** → add siblings of the same type
- **Edit** → rename nodes, change unit_type, add notes
- **Delete** → remove nodes (with soft delete and child handling per the data model)
- **Expand/collapse** → navigate large trees
- The **explainer** is always accessible via "?" icon
- **Tooltips** remain on every unit_type dropdown

### Smart Default Logic

When adding a child, the system suggests the most likely next `unit_type` based on the parent:

| Parent unit_type | Suggested child type | Other valid options |
|-----------------|---------------------|-------------------|
| `premises` | `area` | zone (skip area) |
| `area` | `zone` | section (skip zone) |
| `zone` | `section` | sub_section (skip section) |
| `section` | `sub_section` | container, shelf |
| `sub_section` | `shelf` | container |
| `container` | `shelf` | — |
| `shelf` | — | (leaf node, no children) |

The suggested type is pre-selected in the dropdown. All valid options are shown. Invalid options (e.g., adding a `premises` under a `zone`) are not shown.

### Entities Involved
- [[Space]] (insert, update, soft delete)

---

## Phase 5 — Template Option

Available at **any point** during Phase 3 or Phase 4. A "Use a template" button is persistently visible.

### Flow
1. User clicks "Use a template"
2. Browse available [[SpaceTemplate]]s — system-provided ("Standard Kitchen", "Bar Setup", "Walk-in Pantry") and crew-created (if any)
3. Preview the template's hierarchy as a tree
4. **If user has already built spaces:**
   - Prompt: "Replace your current setup or merge?"
   - **Replace** — deletes (soft) all existing spaces under the current Premises, stamps out the template
   - **Merge** — adds the template's nodes alongside existing ones under the current Premises, handling name conflicts by appending numbers
5. **If user has no spaces yet (beyond Premises):**
   - Stamps out directly, no prompt needed
6. User can customize the stamped template in the tree editor (Phase 4)

### Entities Involved
- [[SpaceTemplate]] (read)
- [[Space]] (insert for stamped nodes, soft delete for replaced nodes)

---

## Ongoing Access

After onboarding, the Spaces page (`/spaces`) uses the **same tree editor** from Phase 4 as its primary interface. The guided flow (Phase 3) is only shown during onboarding. Users can:

- Add, edit, and delete spaces at any time
- Apply templates to add new branches (with merge/replace prompt)
- Access the explainer via the "?" icon
- Save their current setup as a custom [[SpaceTemplate]] for reuse

---

## Data Model Touchpoints

| Entity | Operations During Setup |
|--------|----------------------|
| [[Space]] | Insert (one per node), read (tree display), update (edit name/type), soft delete (remove) |
| [[SpaceTemplate]] | Read (browse templates), insert (save custom template — future) |
| [[Crew]] | Read (crew_id for new spaces) |

No new entities are introduced by this journey. All operations use existing [[Space]] and [[SpaceTemplate]] tables.

---

## See Also

- [[Space]] — entity definition with full field list and hierarchy rules
- [[SpaceTemplate]] — template entity definition
- [[Journey - Onboarding]] — this journey is Step 5 of the onboarding wizard
- [[Feature 2 - Space Hierarchy Setup]] — feature-level overview
