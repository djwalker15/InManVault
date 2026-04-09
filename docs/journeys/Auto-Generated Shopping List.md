# User Journey: Auto-Generated Shopping List

> Covers how items get onto shopping lists automatically — low stock alerts, recipe needs, and planned batch requirements
> Referenced by [[InMan User Journeys]] #17

---

## Overview

InMan can automatically populate shopping lists based on three triggers: low stock alerts, recipe ingredient needs, and planned batch requirements. Each trigger type is **configurable** — some auto-add to a dedicated list, others suggest for user review.

Auto-generated items land on a dedicated **"Suggested Items"** list that acts as a staging area. From there, users review suggestions and move items to their real shopping lists (e.g., "H-E-B run", "Sysco order").

---

## The Suggested Items List

Every [[Crew]] has an auto-created system list called **"Suggested Items"** (or a user-configurable name). This list:

- Is always present — cannot be deleted or archived
- Receives auto-generated items based on trigger configuration
- Acts as a **review queue**, not a shopping list taken to the store
- Items are reviewed and either moved to a real shopping list, dismissed, or left for later

### Suggested Item Row

| Item | Qty Suggested | Reason | Current Stock | Action |
|------|--------------|--------|---------------|--------|
| Cholula Hot Sauce | 2 count | Low stock (below min: 3) | 1 count | [Add to list] [Dismiss] |
| Sugar | 1 cup | Recipe: Simple Syrup (deficit) | 1 cup (need 2) | [Add to list] [Dismiss] |
| Lime Juice | 8 oz | Batch: Margaritas Sat (deficit) | 0 oz | [Add to list] [Dismiss] |

**"Add to list"** → picker showing all active [[ShoppingList]]s. User selects which list. Item is moved (removed from Suggested, added to the chosen list with source tracking preserved).

**"Dismiss"** → item removed from Suggested. Can reappear if the trigger fires again.

---

## Trigger 1 — Low Stock

**When:** An [[InventoryItem]]'s cached `quantity` drops below its `min_stock` threshold (or reaches 0).

**Behavior (configurable per Crew):**
- **Auto-add** (default): Item is automatically added to the Suggested Items list. No user action needed.
- **Notify only**: Dashboard alert appears but no list item created. User can manually add from the alert.
- **Disabled**: No action taken.

**Quantity suggested:** `min_stock - quantity` (the deficit to bring stock back to minimum). If `min_stock` = 3 and `quantity` = 1, suggest buying 2.

**Source tracking:**
- [[ShoppingListItem]] created with `source_type` = `low_stock`
- [[ShoppingListItemLowStockSource]] child row created with `inventory_item_id` = the specific item that triggered the alert

**Deduplication:** If the same [[InventoryItem]] already has a pending suggestion on the Suggested Items list, don't create a duplicate. If the deficit has changed (stock dropped further), update the existing suggestion's quantity.

**Configuration stored in:** [[Crew]] `settings` JSON:
```json
{
  "shopping_triggers": {
    "low_stock": "auto_add"
  }
}
```

---

## Trigger 2 — Recipe Needs

**When:** A user is planning to cook a [[Recipe]] and views the ingredient availability (during [[Journey - Cooking a Meal]] Step 2 or from the recipe view page). Ingredients that are insufficient or missing are flagged.

**Behavior (configurable per Crew):**
- **Suggest and confirm** (default): System shows which ingredients are short and offers to add them to the shopping list. User reviews and confirms.
- **Auto-add**: Deficits are auto-added to the Suggested Items list.
- **Disabled**: No action taken.

**Quantity suggested:** Deficit only — what's needed minus what's available. "You need 2 cups sugar for Simple Syrup, but you only have 1 cup. Add 1 cup to your shopping list?"

**The confirmation flow (when set to suggest and confirm):**

After viewing ingredient availability on a recipe, a "Shopping needed" indicator appears if any ingredients are short:

> **3 ingredients need shopping:**
> - Sugar: need 1 cup more
> - Lime Juice: need 8 oz (out of stock)
> - Triple Sec: need 2 oz more
>
> [Add all to Suggested Items] [Add to specific list ▾] [Dismiss]

**Source tracking:**
- [[ShoppingListItem]] created with `source_type` = `recipe`
- [[ShoppingListItemRecipeSource]] child row created with `recipe_id`

**Deduplication:** If the same [[Product]] is already on the Suggested Items list from a different trigger, prompt: "Sugar is already on your Suggested Items (2 lbs from low stock). Add 1 cup more from this recipe need, or merge?"

---

## Trigger 3 — Planned Batch

**When:** A user plans a [[BatchEvent]] in advance (future feature: batch scheduling). The batch's ingredient requirements at the planned scale are compared against current inventory.

**Behavior (configurable per Crew):**
- **Suggest and confirm** (default): Same confirmation flow as recipe needs, but with batch context.
- **Auto-add**: Deficits auto-added to Suggested Items list.
- **Disabled**: No action taken.

**Quantity suggested:** Deficit at the planned scale. If the batch is 3× Simple Syrup and you need 6 cups sugar but have 4, suggest 2 cups.

**Source tracking:**
- [[ShoppingListItem]] created with `source_type` = `meal_plan`
- [[ShoppingListItemBatchSource]] child row created with `batch_id`

---

## Configuration

All trigger behaviors are configurable per [[Crew]] in Crew Settings ([[Journey - Crew Management]] → Crew Settings → Preferences):

| Trigger | Options | Default |
|---------|---------|---------|
| Low stock | `auto_add` \| `notify_only` \| `disabled` | `auto_add` |
| Recipe needs | `suggest_confirm` \| `auto_add` \| `disabled` | `suggest_confirm` |
| Planned batch | `suggest_confirm` \| `auto_add` \| `disabled` | `suggest_confirm` |

**Stored in:** [[Crew]] `settings` JSON under `shopping_triggers`.

---

## Moving Items to Real Lists

From the Suggested Items list, users move items to their actual shopping lists:

### Move Single Item
1. Tap "Add to list" on an item
2. Picker shows all active [[ShoppingList]]s
3. Select a list
4. Item is moved: removed from Suggested, added to the chosen list
5. Source tracking (child table row) is preserved — the item on the real list still shows "Low stock" or "Recipe: Simple Syrup" as its source

### Move Multiple Items
1. Select items via checkboxes
2. "Add selected to list" → picker
3. All selected items moved to the chosen list

### Move All
"Add all to [list name]" — one-tap to move everything from Suggested to a specific list.

---

## Integration with Other Journeys

| Journey | How It Connects |
|---------|----------------|
| [[Journey - Checking Stock]] | Low stock alerts trigger suggestions. "Add to list" inline action creates manual entries. |
| [[Journey - Expiry Management]] | Out-of-stock items in triage can be added to shopping lists |
| [[Journey - Cooking a Meal]] | Ingredient availability check (Step 2) triggers recipe need suggestions |
| [[Journey - Prepping for Storage]] | Same ingredient check triggers suggestions |
| [[Journey - Building a Shopping List]] | Users move items from Suggested to their named lists |
| [[Journey - Shopping Trip]] | Named lists are taken to the store |

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[ShoppingList]] | Read/Insert | Suggested Items list (auto-created per Crew), user-created lists |
| [[ShoppingListItem]] | Insert | Auto-generated or confirmed suggestions |
| [[ShoppingListItem]] | Update | Moving between lists, editing quantity |
| [[ShoppingListItem]] | Delete | Dismissing suggestions |
| [[ShoppingListItemLowStockSource]] | Insert | Low stock trigger |
| [[ShoppingListItemRecipeSource]] | Insert | Recipe need trigger |
| [[ShoppingListItemBatchSource]] | Insert | Planned batch trigger |
| [[InventoryItem]] | Read | Current stock levels for deficit calculation |
| [[Product]] | Read | Item display |
| [[Recipe]] | Read | Recipe need context |
| [[BatchEvent]] | Read | Planned batch context |
| [[Crew]] | Read (`settings`) | Trigger configuration |

---

## See Also

- [[Journey - Building a Shopping List]] — manual list building
- [[Journey - Shopping Trip]] — taking the list to the store
- [[Journey - Checking Stock]] — low stock alerts feed into this journey
- [[Journey - Cooking a Meal]] — recipe availability check triggers suggestions
- [[Journey - Crew Management]] — trigger configuration in Crew settings
- [[ShoppingListItem]] — `source_type` enum + child tables for source tracking
