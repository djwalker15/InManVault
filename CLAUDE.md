# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the **InMan design vault and active codebase** for the InMan inventory management product. It contains the design vault under `docs/`, the live frontend under `app/`, the database schema under `supabase/`, and a read-only design-system handoff under `inman-design-system/`.

What previously lived in a separate prototype repo now lives here: the React + Supabase frontend at `app/` is the implementation target for everything documented in the vault.

## Read this first

`docs/CLAUDE.md` is the authoritative project brief. It covers the tech stack, auth model (Clerk + Supabase), RLS patterns, every architectural decision (Flow ledger as canonical source, quantity-as-cache, soft deletes, atomic edge functions, unit conversion rules, enum + child table pattern, kiosk auth), the full 43-entity data model, and all 26 user journeys. **Before answering any question about the product, data model, or architecture, read `docs/CLAUDE.md`** — the summaries in individual entity/feature notes are often less current.

Where `docs/CLAUDE.md` and an older note disagree, `docs/CLAUDE.md` wins. It also contains a "Superseded Guidance" section listing decisions that have been reversed.

## Repo layout

```
.
├── app/                         # live frontend (Vite + React 19 + TS + Clerk + Supabase)
│   ├── src/
│   │   ├── routes/              # React Router pages
│   │   ├── components/          # shared components
│   │   │   ├── ds/              # design-system primitives (NavHeader, Buttons, Field, …)
│   │   │   ├── auth/            # Clerk-aware auth UI
│   │   │   ├── onboarding/      # OnboardingLayout, ProgressBar
│   │   │   └── signed-in/       # SignedInLayout, BottomNav
│   │   ├── lib/                 # supabase client hook, utils
│   │   └── test/                # vitest setup, Clerk + Supabase mocks
│   └── package.json             # vitest + playwright + tailwind v4 + clerk + supabase
├── supabase/
│   └── migrations/              # canonical schema. Pattern: YYYYMMDDHHMMSS_<slice>.sql
├── inman-design-system/         # READ-ONLY handoff bundle from Claude Design.
│   └── project/
│       ├── colors_and_type.css  # token source — mirrored into app/src/index.css
│       ├── ui_kits/inman-app/   # JSX reference components (Brand, Buttons, Cards, …)
│       ├── journeys/*.jsx       # canonical interaction prototypes for the 6 journeys
│       └── docs/journeys/*.md   # spec-level journey docs
├── docs/                        # Obsidian vault — design + product source of truth
│   ├── CLAUDE.md                # authoritative project brief — start here
│   ├── InMan Data Model.md
│   ├── InMan User Journeys.md
│   ├── InMan_ERD.mermaid
│   ├── entities/                # 43 entity notes (one .md per table)
│   ├── features/                # 11 feature specs
│   ├── journeys/                # 24 user-journey notes (2 absorbed)
│   ├── cross-cutting/           # cost flow, user attribution, nullable crew_id
│   ├── *.canvas                 # Obsidian canvas files
│   └── Edge Review.md           # per-edge annotations for User Journeys v2.canvas
└── .gitignore                   # excludes .obsidian/, .env, node_modules
```

`inman-design-system/` is a reference bundle, not an npm package. The CSS tokens have been mirrored into `app/src/index.css`; the JSX components are reference implementations to translate into Tailwind + TS components under `app/src/components/ds/`.

## Working in a worktree (parallel sessions)

When asked to work in a worktree (e.g. "make a worktree for kiosk-pin"):

1. Run `scripts/new-worktree.sh <slice>` from the repo root. It creates `~/inman-<slice>` off
   `origin/dev`, copies the gitignored env files a fresh checkout can't inherit (`app/.env.local`,
   `app/.env.test`, `supabase/.env.local`), runs `npm ci` (which re-wires the husky hooks, since
   `core.hooksPath` is the relative `app/.husky/_`), and reserves a free Vite port in `.dev-port`.
2. Switch the session in with `EnterWorktree`, passing **`path`** set to the path the script printed.

**Never pass `EnterWorktree`'s `name` parameter here.** That creates a second, unprovisioned worktree
under `.claude/worktrees/` — no env files, no deps, no port, and on the `/mnt/c` Windows mount, which
is dramatically slower for `node_modules` and file watching. `$HOME` is deliberate.

Cleanup is `scripts/new-worktree.sh <slice> --rm`, run from the main checkout. `ExitWorktree` will not
remove a worktree entered by `path`; `action: "keep"` only returns the session to its original directory.

**Local Supabase is one Docker stack per machine**, keyed on `project_id` in `supabase/config.toml`.
Only one worktree runs `scripts/dev-stack.sh`; the others run the app alone against it
(`npm run dev --prefix app -- --port <reserved> --strictPort`). A `--reset` from any worktree wipes the
data every worktree shares. Playwright reads `.dev-port`, so `test:e2e` is already isolated per worktree.

## Working in `app/` (frontend)

- **Stack:** Vite 8, React 19, TypeScript, React Router v7, Clerk v5, Supabase JS v2, Tailwind v4, Vitest 4, Playwright 1.59.
- **Auth:** Clerk on the frontend, Supabase RLS on the backend. Clerk JWT is plumbed through `useSupabase()` at `app/src/lib/supabase.ts` so every query carries `auth.jwt()->>'sub'`.
- **No `auth.uid()`** — Clerk user IDs are text strings (`user_2abc…`), so RLS policies use `auth.jwt()->>'sub'` and DB columns are `text`, never UUID.
- **Tailwind tokens** mirror the design system: `sage-700/600/500/300/100`, `paper-50/100/150/200/250/300`, `ink-900/700/600/500/400/300`, `shadow-ambient-{sm,md,lg}`, `shadow-cta`, `shadow-cta-strong`. Composable utilities (`--gradient-primary`, `--glass-bg`, `--glass-blur`, `--glass-border`) live as CSS variables for sticky CTAs and glassmorphism. Avoid raw hex codes.
- **Design-system rules** (from `inman-design-system/project/SKILL.md`): no #000, no 1px container borders, sage CTAs are gradients, surfaces nest one tier at a time, inputs have no box (paper-100 fill + sage bottom-bar on focus), one emoji (🎉 on the "Your pantry is live" hero card).
- **Tests:** `npm test` (vitest watch) or `npm run test:run` (single pass). E2E with `npm run test:e2e`. The repo's husky pre-commit runs eslint + `vitest related` on staged files.

## Working in `supabase/migrations/` (schema)

- **Naming:** `YYYYMMDDHHMMSS_<slice>.sql`, where `<slice>` describes the feature scope (`auth_slice`, `spaces_slice`, `inventory_slice`, etc.).
- **RLS:** every table gets policies. Write the SELECT policy first — `INSERT … RETURNING` errors out if SELECT fails after the WITH CHECK passes (the "RLS RETURNING trap"). Use `auth.jwt()->>'sub'` to identify the caller; resolve membership via `crew_members` joins.
- **Soft delete:** mutable entities have `deleted_at timestamptz`. Active queries filter `WHERE deleted_at IS NULL` (or RLS does it for them).
- **Immutable entities** (Flow + children, WasteEvent, BatchInput/Output, RecipeStep, IntakeSession*, UnitDefinition) have `created_at` only — no `updated_at`, no `deleted_at`.
- **Enum + child table for polymorphic FKs** (Flow, RecipeIngredient, ShoppingListItem, WasteEvent). Never add nullable FK columns on a parent.
- **Quantity is a cache.** `inventory_items.quantity` is a cached sum of `flows`. Direct quantity updates aren't allowed — every change goes through a Flow row, with a trigger keeping the cache in sync.

## Working in `inman-design-system/` (handoff bundle)

This directory is **read-only**. Don't edit JSX components or CSS here — they're the canonical handoff. To make a UI change, mirror it into `app/src/components/ds/` (or wherever it belongs in the live app).

When implementing a journey screen:

1. Read the spec at `inman-design-system/project/docs/journeys/<Journey>.md`.
2. Skim the JSX prototype at `inman-design-system/project/journeys/<Journey>.jsx` for layout shape and component composition.
3. Translate to React + TS using DS primitives from `app/src/components/ds/` and Tailwind classes that reference the migrated tokens.
4. Don't copy the prototype's inline styles wholesale — use Tailwind classes; reach for the JSX only for proportions and component nesting.

Saved-memory rule: **Figma-exported SVGs need `preserveAspectRatio="none"` and `width/height="100%"` stripped on ingest**, otherwise they stretch.

## Working in `docs/` (vault)

- **Wikilinks** (`[[Flow]]`, `[[Journey - Logging Waste]]`) are the primary cross-reference mechanism. Obsidian resolves them by filename — renaming a note without updating inbound links breaks the graph.
- Entity notes reference the feature(s) they belong to at the top (`> Part of [[Feature 7 - In-Out Flows]]`).
- Feature notes list their entities and the journeys that touch them.
- Journey notes reference the entities they read/write.
- The two index files (`InMan Data Model.md`, `InMan User Journeys.md`) are the table-of-contents and should be updated whenever an entity or journey is added/renamed/absorbed.

`InMan_ERD.mermaid` is a standalone mermaid ERD source; keep it consistent with the entity notes when schema decisions change.

The `.canvas` files (`User Journeys v2.canvas` is the current one) are Obsidian canvases — JSON graphs of nodes and edges. `Edge Review.md` is a living table where each edge gets a row with **Data Flow** and **UI Detail** annotations. When editing a journey's flow, the canvas edges and `Edge Review.md` need to stay in sync.

## Conventions to preserve when editing

- **`docs/CLAUDE.md` is the source of truth for architecture decisions.** If you change a decision, update it there first, then propagate to entity/feature/journey notes, then update code.
- **Entity notes use the enum + child table pattern** for polymorphic references. Never add nullable FK columns on a parent entity. See `docs/CLAUDE.md` §"Enum + child tables" for the rationale.
- **All `user_id` fields are `text`**, not UUID. RLS uses `auth.jwt()->>'sub'`.
- **Soft deletes use `deleted_at`** on mutable entities. Immutable entities have `created_at` only.
- **Terminology:** "Space" (not Location) for hierarchy nodes; "location" only refers to `home_space_id` / `current_space_id` on an item. "Crew" is the tenant boundary. "Owner" is distinct from "Admin".
- **Commit style:** Conventional Commits — `feat(scope): …`, `refactor(scope): …`, `fix(scope): …`, `docs(scope): …`. Match the existing history in `git log`.

## Treat a task as done when

- Code change is committed with a passing pre-commit (eslint + vitest --related).
- Affected vault notes are updated (entity/feature/journey + the relevant index, plus `docs/CLAUDE.md` if a decision changed, plus the ERD if schema changed, plus the canvas + `Edge Review.md` if a journey flow changed).
- For schema changes: a migration exists under `supabase/migrations/`, applied locally, and the relevant entity note in `docs/entities/` reflects the new shape.
