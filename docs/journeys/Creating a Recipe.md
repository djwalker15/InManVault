# User Journey: Creating a Recipe

> Covers the complete recipe creation experience — from naming to ingredients to steps
> Referenced by [[InMan User Journeys]] #9

---

## Overview

Creating a Recipe builds a reusable formula that connects to the cost pipeline, enables batching, and integrates with shopping lists. The experience is a **hybrid layout** — all sections visible at once with a logical top-to-bottom flow. A live cost estimate updates as ingredients are added.

The first save creates the initial [[RecipeVersion]], freezing the ingredient list and steps. Subsequent edits create new versions (see [[Journey - Editing a Recipe]]).

---

## Entry Points

| Entry Point | Context |
|-------------|---------|
| **Recipes page** (`/recipes`) — "New Recipe" button | Blank form |
| **After batching** — "Save as recipe" from a completed [[BatchEvent]] | Pre-populated from batch inputs |
| **From another recipe** — "Duplicate" on an existing recipe | Pre-populated from source recipe |

---

## The Recipe Form

All sections visible on one page, logical flow top to bottom.

### Section 1 — Recipe Info

| Field | Required | Notes |
|-------|----------|-------|
| Name | Yes | e.g., "Simple Syrup", "Margarita", "Tuesday Night Chili" |
| Description | No | Brief description or notes about the recipe |
| Yield quantity | Yes | How much this recipe produces at base scale (e.g., 32) |
| Yield unit | Yes | Unit for the yield (e.g., "oz", "servings", "cups") — from [[UnitDefinition]] |
| Prep time | No | Minutes |
| Cook time | No | Minutes |
| Photo | No | Upload or camera capture |

> **`output_product_id` is NOT set during creation.** It's configured later if/when the user decides to batch for storage. See [[Recipe]] entity for details.

### Section 2 — Ingredients

An interactive list builder. Each ingredient row has a search field and quantity/unit inputs.

#### Adding an Ingredient

The user types in a search field. Results appear in four groups:

**Group A — Product Groups (generic)**
Matching [[ProductGroup]]s from the catalog. e.g., typing "sugar" shows "Sugar" as a group.
- Selecting links the ingredient to the ProductGroup
- At batch time, the system will prompt which specific [[InventoryItem]] to deduct from (FIFO suggestion)

**Group B — Specific Products**
Matching [[Product]]s from the master catalog and crew-private products. e.g., "Domino Pure Cane Sugar, 4 lb"
- Selecting links the ingredient to the specific Product

**Group C — Your Recipes (sub-recipes)**
Matching [[Recipe]]s owned by or shared with the [[Crew]]. e.g., "Simple Syrup"
- Selecting links the ingredient as a sub-recipe
- Circular reference check runs immediately — if this would create a cycle, the result is grayed out with an explanation

**Group D — Create / Leave Unlinked**
Always visible at the bottom:
- **"Create product group '[query]'"** — creates a new [[ProductGroup]] (crew-private), links ingredient to it
- **"Create product '[query]'"** — creates a new [[Product]] (crew-private), links ingredient to it
- **"Leave unlinked"** — stores as `free_text_name`. Recipe can be saved but not batched until linked.

#### Per-Ingredient Fields

| Field | Required | Notes |
|-------|----------|-------|
| Ingredient reference | Yes | One of: [[ProductGroup]], [[Product]], [[Recipe]], or free-text |
| Quantity | Yes | Numeric |
| Unit | Yes | From [[UnitDefinition]] |
| Notes | No | e.g., "melted", "room temperature", "divided" |

#### Ingredient List Behavior

- **Drag to reorder** — `sort_order` updated
- **Remove** — delete an ingredient row
- **Unlinked indicator** — free-text ingredients show ⚠️ "Unlinked — link to a product or group to enable batching and cost tracking"
- **Duplicate detection** — if the user adds the same Product/ProductGroup twice, prompt: "You already have [name] in this recipe. Add another line or increase the quantity?"

### Live Cost Estimate

A running cost total displayed alongside the ingredients list:

```
Estimated Cost: $4.72
  Sugar (ProductGroup)     2 cups × $0.12/cup  = $0.24
  Water                    2 cups × —           = —
  Lemon Juice              1 oz   × $0.38/oz   = $0.38
  ──────────────────────────────────────────────
  3 of 3 ingredients costed | 0 unlinked

  Cost per yield unit: $0.15 / oz (based on 32 oz yield)
```

**Cost resolution:**
- **Specific Product ingredient:** Uses `last_unit_cost` from the Crew's [[InventoryItem]] for that Product. If multiple InventoryItems exist, uses the most recent cost. If no InventoryItem exists, shows "—" (no cost data).
- **ProductGroup ingredient:** Uses the average `last_unit_cost` across InventoryItems for Products in the group. If none exist, shows "—".
- **Sub-recipe ingredient:** Recursively calculates from the sub-recipe's ingredients.
- **Free-text (unlinked):** Shows "—" with ⚠️ indicator.

**Missing data indicator:** "2 of 5 ingredients have no cost data" — clearly shows when the estimate is incomplete.

**Cost per yield unit:** Total cost ÷ yield quantity. Useful for pricing ("this cocktail costs $1.20 to make").

### Section 3 — Steps

An ordered list of instruction steps. Minimum one step required.

#### Per-Step Fields

| Field | Required | Notes |
|-------|----------|-------|
| Step number | Auto | Auto-incremented, updates on reorder |
| Instruction | Yes | Text — "Combine sugar and water in a saucepan over medium heat" |
| Photo | No | Upload or capture for this step |

#### Step List Behavior

- **Add step** — new row at the bottom
- **Drag to reorder** — step numbers update automatically
- **Remove** — delete a step (must keep at least one)
- **Rich text (future)** — plain text for now, could add formatting later

---

## Saving

### First Save

**On save:**
- [[Recipe]] created (name, description, yield_quantity, yield_unit, prep/cook times, photo_url, crew_id, created_by). `output_product_id` is null.
- [[RecipeVersion]] created (version_number = 1, yield/timing fields snapshot)
- [[RecipeIngredient]] rows created for each ingredient (linked to the RecipeVersion)
- [[RecipeStep]] rows created for each step (linked to the RecipeVersion)
- Recipe's `current_version` set to this RecipeVersion

**Validation before save:**
- Name is required
- Yield quantity and unit are required
- At least one ingredient
- At least one step
- Unlinked ingredients are **allowed** (recipe saves but is flagged as incomplete for batching)

**Success:** "Recipe '[name]' created!" with options: "View recipe", "Create another", "Start a batch" (disabled if unlinked ingredients exist)

### Crew-Private vs. Shared

New recipes default to **crew-private** (`crew_id` set). The creator can change visibility later to shared (`crew_id` → null) if they want other Crews to use it. Sharing is a separate action, not part of initial creation.

---

## After Creation

The saved recipe is viewable with:
- All info, ingredients (with cost breakdown), and steps
- **Status indicators:**
  - ⚠️ "2 unlinked ingredients" — if free-text ingredients exist
  - 💲 "Cost estimate: $4.72 (3 of 5 ingredients costed)" — if cost data is incomplete
  - ✅ "Ready to batch" — all ingredients linked, cost fully calculable
- **Actions:** Edit (→ [[Journey - Editing a Recipe]]), Duplicate, Delete (soft), Share, "Set output product" (→ link `output_product_id` for store-intent batching), Start a batch (→ [[Journey - Cooking a Meal]] or [[Journey - Prepping for Storage]])

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[Recipe]] | Insert | Save |
| [[RecipeVersion]] | Insert | Save (version 1) |
| [[RecipeIngredient]] | Insert | One per ingredient |
| [[RecipeStep]] | Insert | One per step |
| [[ProductGroup]] | Read / Insert | Ingredient search / creating new group |
| [[Product]] | Read / Insert | Ingredient search / creating new crew-private product |
| [[Recipe]] (other) | Read | Sub-recipe search |
| [[InventoryItem]] | Read | Live cost estimate (looking up `last_unit_cost`) |
| [[Category]] | Read | ProductGroup and Product default categories |
| [[UnitDefinition]] | Read | Unit dropdowns for yield and ingredients |

## New Entity Introduced

- [[ProductGroup]] — generic product concept (e.g., "Sugar"). [[Product]]s link to groups via `product_group_id`. [[RecipeIngredient]] can reference a ProductGroup for generic ingredients.

## Data Model Changes

- [[Product]] gains `product_group_id` (FK → [[ProductGroup]], nullable)
- [[RecipeIngredient]] gains `product_group_id` (FK → [[ProductGroup]], nullable) and `free_text_name` (text, nullable). Constraint updated: exactly one of `product_id`, `product_group_id`, `sub_recipe_id`, or `free_text_name` must be non-null.

---

## See Also

- [[Journey - Editing a Recipe]] — modifying a saved recipe, versioning kicks in
- [[Journey - Cooking a Meal]] — batching with consume intent
- [[Journey - Prepping for Storage]] — batching with store/split intent
- [[Recipe]] — entity definition with `output_product_id` (set after creation, not during)
- [[RecipeVersion]] — versioning model
- [[RecipeIngredient]] — four reference types (Product, ProductGroup, sub-Recipe, free-text)
- [[ProductGroup]] — generic product concept
- [[Cost Data Flow]] — recipe costing feeds into batch costing and waste costing
