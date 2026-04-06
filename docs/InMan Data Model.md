# InMan — Conceptual Data Model

> **Generated:** March 25, 2026 | **Updated:** March 31, 2026
> **Purpose:** Map all planned features, their data requirements, and how they connect — designed for Obsidian graph view
> **Status:** Conceptual — not yet implemented
> **Auth Provider:** Clerk (string-based user IDs, all user profile data managed by Clerk)

---

## Entities

### Core
- [[Crew]] — Tenant boundary
- [[User]] — Local reference to Clerk-managed user (slim table)
- [[CrewMember]] — Join table linking [[User]]s to [[Crew]]s
- [[Invite]] — Invitation to join a Crew

### Spaces
- [[Space]] — Physical hierarchy node
- [[SpaceTemplate]] — Pre-built hierarchy blueprints

### Catalog
- [[Product]] — Universal product definition (has `source` field tracking origin: seeded, barcode_api, crew_created, manual, promoted)
- [[Category]] — Product/item categorization
- [[InventoryItem]] — Crew-specific product instance at a location (quantity is a **cache** derived from [[Flow]] ledger)
- [[ProductSubmission]] — Review queue for promoting crew-private Products to master catalog

### Reference Data
- [[UnitDefinition]] — Unit conversion reference (weight, volume, count)

### Transactions
- [[Flow]] — Core transaction ledger (canonical source of truth for quantity and movement)
- [[IntakeSession]] — Session-based batch receiving (post-shopping intake or delivery)
- [[IntakeSessionItem]] — Line items within an intake session (expected vs. received, discrepancy tracking)

### Waste
- [[WasteEvent]] — Slim waste record (reason, total_cost, photo, notes — all other fields derived from [[Flow]])
- [[WasteExpiredDetail]] — Context for expired waste
- [[WasteSpoilageDetail]] — Context for spoiled waste
- [[WasteDamageDetail]] — Context for damaged waste
- [[WastePrepFailureDetail]] — Context for prep failure waste
- [[WasteSpillDetail]] — Context for spilled waste
- [[WasteOtherDetail]] — Context for other waste

### Recipes & Batching
- [[Recipe]] — Formula for producing something (has `output_product_id` for store intent)
- [[RecipeVersion]] — Versioned snapshot of a recipe
- [[RecipeIngredient]] — Ingredient line (DB trigger prevents circular references)
- [[RecipeStep]] — Instruction step in a recipe version
- [[BatchEvent]] — Execution of a recipe (completion is an atomic edge function)
- [[BatchInput]] — Ingredient consumed during a batch
- [[BatchOutput]] — Output produced by a batch

### Shopping
- [[ShoppingList]] — Named, collaborative shopping list
- [[ShoppingListItem]] — Line item with separate source FKs (not polymorphic)

### Kiosk
- [[KioskSession]] — Device-level session with token-based auth (Path B). Two-step identification: name select → PIN confirm.

---

## Features

1. [[Feature 1 - Multi-Organization Tenancy]]
2. [[Feature 2 - Space Hierarchy Setup]]
3. [[Feature 3 - Item Catalog]]
4. [[Feature 4 - Inventory Level Tracking]]
5. [[Feature 5 - Assignment and Location Tracing]]
6. [[Feature 6 - Waste Tracking]]
7. [[Feature 7 - In-Out Flows]]
8. [[Feature 8 - Recipes]]
9. [[Feature 9 - Batching and Prepping]]
10. [[Feature 10 - Shopping List]]
11. [[Feature 11 - Kiosk Mode]]

---

## User Journeys

> Full index with all 26 journeys, statuses, and dependencies: [[InMan User Journeys]]

- [[Journey - Onboarding]] — Landing page → sign up → crew creation → space setup → first items → invite members → kiosk enrollment
- [[Journey - Space Setup]] — Detailed first-time space hierarchy setup (Explainer → Premises → Guided First Branch → Tree Editor → Templates)
- [[Journey - Crew Management]] — Eight admin actions: invite, change roles, permission overrides, remove members, transfer ownership, leave, edit settings, delete crew (48h waiting period). Owner distinct from Admin.
- [[Journey - Adding Inventory]] — Four methods: manual search/create (two-step), bulk import, barcode scan, quick add. Stay-in-flow for multiple items.
- [[Journey - Checking Stock]] — Search, browse by Space/Category, filter by stock status, inline expansion with detail + actions, alerts summary.
- [[Journey - Intake Session]] — Session-based batch receiving. Two modes: batch table (list-seeded) and sequential (from-scratch). Discrepancy tracking, deferred shelving. Also covers Post-Shopping Intake.
- [[Journey - Moving Items]] — Five scenarios: single move, put-back routine, set home locations, bulk reassign with preview, reorganize (space-centric or item-centric).
- [[Journey - Logging Waste]] — Five entry points, flexible item/reason ordering, six reason-specific detail forms, smart quantity defaults, confirmation step, atomic edge function.

---

## Cross-Cutting Concerns

- [[Cost Data Flow]]
- [[Nullable crew_id Pattern]]
- [[User Attribution]]

---

## Architecture Decisions

- **Quantity is a cache.** [[Flow]] ledger is canonical. See [[InventoryItem]], [[Flow]].
- **Soft deletes everywhere.** Mutable entities use `deleted_at`. Immutable records (Flow, WasteEvent, etc.) never deleted.
- **Atomic edge functions.** Batch completion, waste logging, shopping checkout, bulk reassignment wrapped in transactions.
- **No `direction` on Flow.** Derived from `flow_type`. See [[Flow]].
- **Slim WasteEvent.** Waste-specific fields only; quantity/item/crew/user derived from [[Flow]].
- **Separate source FKs on ShoppingListItem.** Not polymorphic. See [[ShoppingListItem]].
- **Recipe output_product_id.** Links recipe to its output [[Product]] for store intent. See [[Recipe]].
- **Circular reference guard.** App-level + DB trigger on [[RecipeIngredient]].
- **Within-category unit conversion.** See [[UnitDefinition]].
- **Kiosk uses token-based auth (Path B).** Independent of Clerk sessions. See [[KioskSession]].
- **Invite system.** Code-based invites with expiry and revocation. See [[Invite]].
