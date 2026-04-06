# Feature 8 — Recipes

## Entities

- [[Recipe]] — formula definition
- [[RecipeVersion]] — versioned snapshot
- [[RecipeIngredient]] — ingredient line
- [[RecipeStep]] — instruction step

## Summary

Recipes with nested sub-recipe support, versioning on each edit, runtime scaling, and recursive cost calculation. Shareable across [[Crew]]s or crew-private. Versioning ensures historical [[BatchEvent]]s reference the exact recipe state used.

## Key Capabilities

- **Nested recipes** — ingredients can be [[Product]]s or other [[Recipe]]s
- **Versioning** — each edit creates a [[RecipeVersion]]; batches reference specific versions
- **Scaling** — runtime calculation based on `scale_factor` against base yield
- **Cost calculation** — recursive through sub-recipes (see [[Cost Data Flow]])
- **Sharing** — [[Nullable crew_id Pattern]]

## Dependencies

- [[Feature 3 - Item Catalog]] — [[RecipeIngredient]]s reference [[Product]]s
- [[Feature 9 - Batching and Prepping]] — [[BatchEvent]] executes a [[RecipeVersion]]
