# Nullable crew_id Pattern

> Cross-cutting concern spanning multiple features

Three entities use a nullable `crew_id` to distinguish global (system-wide) records from crew-scoped records.

## Pattern

| Entity | `crew_id` = null | `crew_id` = set |
|--------|-----------------|----------------|
| [[Product]] | Master catalog — shared across all [[Crew]]s | Crew-private custom product |
| [[Category]] | System default category | Crew-custom category |
| [[Recipe]] | Shared recipe — available to all [[Crew]]s | Crew-private recipe |

## How It Works

- Global records (null `crew_id`) are visible to every [[Crew]]
- Crew-scoped records are only visible to the owning [[Crew]]
- When querying, the app layer unions global records with the current [[Crew]]'s records
- This avoids data duplication while still allowing customization

## Additional Uses

- [[SpaceTemplate]] also uses this pattern: null = system-provided template, set = crew-created template

## Features Involved

- [[Feature 3 - Item Catalog]] — [[Product]] and [[Category]]
- [[Feature 8 - Recipes]] — [[Recipe]]
- [[Feature 2 - Space Hierarchy Setup]] — [[SpaceTemplate]]
