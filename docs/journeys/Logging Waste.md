# User Journey: Logging Waste

> Covers the complete waste logging workflow — from identifying what was wasted to capturing reason-specific context
> Referenced by [[InMan User Journeys]] #13

---

## Overview

Logging waste captures what was lost, how much, why, and the context surrounding it. The data feeds into cost reporting ([[Cost Data Flow]]) and future pattern detection ("items in the Crisper expire 2x more often").

The flow is **flexible in ordering** — it works whether the user starts with the item (most common) or the reason (e.g., "something just spilled"). Every entry point pre-fills whatever context is already known, and the form adapts to collect the rest.

Each waste log is **atomic via edge function**: waste [[Flow]] + [[WasteEvent]] + reason-specific detail record all created in one transaction, with the cached quantity on [[InventoryItem]] updated and a confirmation step before committing.

---

## Entry Points

Each entry point pre-fills different context, but all feed into the same waste logging form:

| Entry Point | Pre-filled | Typical Scenario |
|-------------|-----------|-----------------|
| **Checking Stock inline action** | Item selected, quantity known | "This Cholula went bad" |
| **Alerts summary (expired/expiring)** | Item selected, reason = expired, expiry date known | "This expired, I'm tossing it" |
| **Dedicated 'Log Waste' action** (nav/quick-add) | Nothing pre-filled | "I need to log something I wasted" |
| **Kiosk Mode** | Crew and premises scoped | "Bartender spilled a bottle" |
| **Batch failure** (during [[Journey - Cooking a Meal]] or [[Journey - Prepping for Storage]]) | Item(s) from batch inputs, reason = prep_failure, recipe + batch pre-filled | "This batch went wrong" |

---

## The Form

The waste logging form has four sections that adapt based on what's already known. Sections can be completed in any order, but all must be filled before submission.

### Section 1 — What Was Wasted (Item Selection)

**If pre-filled** (from Checking Stock, alerts, or batch failure): Item shown as a confirmed header — name, brand, current quantity, location. User can change if wrong.

**If not pre-filled** (dedicated action, kiosk): Search field identical to [[Journey - Adding Inventory]] Step 1 — searches across Product name, brand, barcode. Results show existing [[InventoryItem]]s with quantities and locations. User selects the specific InventoryItem that was wasted.

> **Important:** The user selects an [[InventoryItem]], not a [[Product]]. Waste is deducted from a specific inventory record at a specific location.

### Section 2 — How Much Was Lost (Quantity)

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Quantity wasted | Yes | Smart default (see below) | Numeric input. Cannot exceed item's current cached quantity. |
| Unit | Yes | Item's unit | Pre-filled from [[InventoryItem]], changeable if needed |

**Smart defaults:**
- **Countable items** (unit = count, pkg): default to **1**
- **Measured items** (unit = oz, ml, g, lbs, etc.): default to **empty** — user must enter the amount

**Partial waste indicator:** If quantity < item's total, show: "Logging partial waste: [X] of [total] [unit]"

### Section 3 — Why It Was Wasted (Reason + Details)

**If pre-filled** (from alerts = expired, from batch = prep_failure): Reason pre-selected, user can change.

**If not pre-filled:** Reason selector — six options presented as tappable cards or a dropdown:

| Reason | Icon | One-liner |
|--------|------|-----------|
| Expired | 📅 | Past its expiry date |
| Spoiled | 🦠 | Went bad before expiry |
| Damaged | 💥 | Broken, crushed, or compromised packaging |
| Prep failure | 👨‍🍳 | Overcooked, burned, or ruined during preparation |
| Spilled | 💧 | Dropped, knocked over, or container failed |
| Other | ❓ | Doesn't fit the above categories |

**After selecting a reason, the reason-specific detail form appears:**

#### Expired → [[WasteExpiredDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Expiry date | Yes | Item's `expiry_date` if set | Date picker |
| Days past expiry | Auto-calculated | From expiry date vs. today | Read-only |
| Where was it stored | Yes | Item's `current_space_id` | [[Space]] tree dropdown |
| Was it opened | Yes | — | Yes / No toggle |

#### Spoiled → [[WasteSpoilageDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Expiry date | No | Item's `expiry_date` if set | Date picker (may not have one) |
| Where was it stored | Yes | Item's `current_space_id` | [[Space]] tree dropdown |
| Container type | No | — | Text field — "Tupperware", "original packaging", "Ziploc bag" |
| Days since opened | No | — | Numeric input |
| Storage conditions | No | — | Text field — "left out overnight", "door kept opening" |

#### Damaged → [[WasteDamageDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| How was it damaged | Yes | — | Text field — "dropped", "crushed in bag", "punctured" |
| Where did it happen | No | Item's `current_space_id` | [[Space]] tree dropdown |
| Packaging issue | Yes | No | Yes / No toggle — was the packaging the cause? |

#### Prep Failure → [[WastePrepFailureDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Which recipe | No | Pre-filled if from batch failure | [[Recipe]] search/dropdown |
| Which batch | No | Pre-filled if from batch failure | [[BatchEvent]] reference (auto-linked if recipe selected) |
| What went wrong | Yes | — | Text field — "overcooked", "burned the roux", "wrong temperature" |
| Who was prepping | Yes | Current user | [[CrewMember]] dropdown (important for Haywire training insights) |

#### Spilled → [[WasteSpillDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Where was it spilled | Yes | Item's `current_space_id` | [[Space]] tree dropdown |
| How was it spilled | Yes | — | Text field — "knocked off counter", "lid wasn't tight", "dropped while pouring" |
| During what activity | No | — | Text field — "cooking dinner", "restocking bar", "cleaning" |

#### Other → [[WasteOtherDetail]]

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Description | Yes | — | Freeform text — explain what happened |

### Section 4 — Additional Context

Always available regardless of reason:

| Field | Required | Notes |
|-------|----------|-------|
| Photo | No | Camera capture or image upload. Button available, no prompting. |
| Notes | No | Freeform text for any additional context beyond the detail form |

---

## Confirmation Step

Before submitting, a confirmation screen summarizes everything:

```
⚠️ Log Waste

Item:     Cholula Hot Sauce (5 oz)
Quantity: 1 count (of 3 in Pantry > Shelf 2)
Reason:   Expired
Details:  Expired 4 days ago, stored in Pantry > Shelf 2, was opened
Cost:     $3.50 (based on last unit cost)
Photo:    [thumbnail if captured]

This will deduct 1 count from your inventory.

[Cancel]  [Confirm]
```

**Cost display:** Calculated from `last_unit_cost` on the [[InventoryItem]]. If the item was produced by a [[BatchEvent]], the derived cost (sum of recipe inputs) is used instead. If no cost data exists, shows "Cost: Not tracked."

---

## On Confirm (atomic via edge function)

All of the following happen in a single transaction:

1. **Waste [[Flow]] created** — `flow_type` = waste, `quantity` = amount wasted, `unit_cost` = item's last_unit_cost or derived cost, `performed_by` = current user
2. **[[WasteEvent]] created** — `flow_id` linking to the waste Flow, `waste_reason`, `total_cost` (quantity × unit_cost, using derived cost for batch-produced items), `notes`, `photo_url`
3. **Reason-specific detail record created** — one of the six detail tables, linked to the WasteEvent
4. **[[InventoryItem]] cached quantity updated** — decremented by the wasted amount
5. If quantity reaches 0: item shows as "Out of stock" in alerts

**Success toast:** "Logged waste: [quantity] [unit] of [item name] ([reason])"

---

## After Submit — Stay in Flow

- Form resets to Section 1 (item selection cleared, ready for next waste log)
- Counter: "2 waste events logged this session"
- "I'm done" button exits and returns to the originating page
- If entered from Kiosk Mode, returns to the kiosk home screen (name + PIN identification)

---

## Batch Failure Entry Point (Special Case)

When waste is triggered from a failed [[BatchEvent]] during [[Journey - Cooking a Meal]] or [[Journey - Prepping for Storage]]:

1. The batch is marked as failed/cancelled
2. Waste logging opens with **multiple items pre-loaded** — all [[BatchInput]]s that were already consumed
3. Each item can be logged as waste individually (reason = prep_failure for all, but quantities may vary — maybe only half the butter was ruined)
4. The recipe and batch are pre-filled on every [[WastePrepFailureDetail]]
5. User processes each item, then completes the waste logging session

This is the one scenario where waste logging is inherently multi-item from the start (rather than stay-in-flow being optional).

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[InventoryItem]] | Read | Item search/selection, quantity display, cost lookup |
| [[InventoryItem]] | Update (cached quantity) | Deduction on confirm |
| [[Flow]] | Insert (waste) | One per waste event |
| [[WasteEvent]] | Insert | One per waste event, linked to Flow |
| [[WasteExpiredDetail]] | Insert | When reason = expired |
| [[WasteSpoilageDetail]] | Insert | When reason = spoiled |
| [[WasteDamageDetail]] | Insert | When reason = damaged |
| [[WastePrepFailureDetail]] | Insert | When reason = prep_failure |
| [[WasteSpillDetail]] | Insert | When reason = spilled |
| [[WasteOtherDetail]] | Insert | When reason = other |
| [[Space]] | Read | Location dropdowns in detail forms |
| [[Recipe]] | Read | Prep failure detail — recipe reference |
| [[BatchEvent]] | Read | Prep failure detail — batch reference |
| [[CrewMember]] | Read | Prep failure detail — who was prepping |
| [[Product]] | Read | Item display (name, brand, image) |

> **No new entities introduced.** All operations use existing tables. The atomic edge function creates 3 records per waste event (Flow + WasteEvent + one detail record).

---

## See Also

- [[WasteEvent]] — slim entity, derives quantity/item/crew/user from [[Flow]]
- [[WasteExpiredDetail]], [[WasteSpoilageDetail]], [[WasteDamageDetail]], [[WastePrepFailureDetail]], [[WasteSpillDetail]], [[WasteOtherDetail]] — reason-specific detail tables
- [[Journey - Checking Stock]] — inline "Log waste" action triggers this journey
- [[Journey - Handling Expired Items]] — expired alerts trigger this journey with reason pre-filled
- [[Journey - Cooking a Meal]] / [[Journey - Prepping for Storage]] — batch failure triggers multi-item waste logging
- [[Journey - Reviewing Waste History]] — where logged waste data is analyzed
- [[Cost Data Flow]] — waste cost includes derived cost for batch-produced items
- [[Feature 6 - Waste Tracking]] — feature-level overview
