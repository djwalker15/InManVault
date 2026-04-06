# Feature 9 — Batching and Prepping

## Entities

- [[BatchEvent]] — execution of a recipe
- [[BatchInput]] — ingredient consumed
- [[BatchOutput]] — output produced

## Summary

Executing a [[Recipe]]. Three intents: store (output → inventory), consume (output → eaten, cost still tracked), split (some stored, some consumed). Real-time progress tracking and after-the-fact logging. Actual vs. expected yield captured. Completion generates [[Flow]]s for all inputs and outputs.

## Batch Intents

| Intent | Ingredient Effect | Output Effect | Cost Tracked? |
|--------|------------------|---------------|--------------|
| store | Deducted | Creates/restocks [[InventoryItem]]s | Yes — on items |
| consume | Deducted | Nothing enters inventory (eaten) | Yes — on [[BatchEvent]] |
| split | Deducted | Some stored, some consumed | Yes — both |

## Dependencies

- [[Feature 8 - Recipes]] — [[BatchEvent]] references [[RecipeVersion]]
- [[Feature 7 - In-Out Flows]] — completion generates [[Flow]]s
- [[Feature 3 - Item Catalog]] — inputs and outputs are [[InventoryItem]]s
- [[Feature 2 - Space Hierarchy Setup]] — `output_space_id` references [[Space]]
