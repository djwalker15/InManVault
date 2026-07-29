# Session Handoff — 2026-07-29

> Snapshot for the next Claude session picking up the InMan app. Read this
> after `docs/CLAUDE.md` and `docs/InMan Implementation Plan.md` — those
> are the authoritative product/architecture briefs; this doc is the thin
> "what's been happening lately and what's queued next" layer.
> Supersedes [[Session Handoff - 2026-05-13]].

---

## Where things stand (2026-07-29)

- **`dev` is the integration branch.** PR #36 (Opening a Package / [[Feature 12 - Inventory Item Composition]]) merged 2026-07-29. Staging auto-deploy is green — the `20260625120*` package migrations are verified applied, and `deploy-staging.yml` registers the Clerk TPA idempotently.
- **Open PR stack (merge in order; delete each branch on merge so GitHub retargets the next):**
  1. #41 adjust (`record_adjustment`)
  2. #42 use/consume (`record_consumption`)
  3. #43 waste v1.1 (`record_waste`)
  4. #44 remove/soft-delete (`soft_delete_inventory_item`)
  5. #45 three production bug fixes — edit receipt items via unit/name editing; missing-space validation messages; unknown-unit explanations + parse-receipt unit enum.

  Each PR body has the details. After the stack merges: close ClickUp bugs 86e26x6be / 86e2725qw / 86e26x524 (comments already on them) and delete the merged branches.
- **The full InventoryItem lifecycle is now implemented:** 5 add methods, list/detail/edit, restock, move/put-back, open package, adjust (`record_adjustment`), use (`record_consumption`), waste (`record_waste`), remove (`soft_delete_inventory_item`). All quantity paths go through flows; the RPCs row-lock and cap at on-hand. A DB-level lifecycle test ran clean — the flow sum reconciles to 0 after removal.
- **Vault:** new journey #28 ([[Removing an Inventory Item]]). v1.1 waste schema shipped. Deferred: `prep_failure` FKs + derived batch cost (v1.2), photo capture (needs a storage bucket), waste analytics pages ([[Expiry Management]], [[Reviewing Waste History]]).
- **ClickUp:** full tidy done 2026-07-29 — Inbox emptied (routing report task 86e2j3ntv left in Inbox), 21 stale founder items closed, the composition cluster closed. Open decisions for the founder: QA/Verification list (wire issue-intake or drop it), Walkthrough Feedback triage shortlist (in 86e2j3ntv), release PR #40.
- Stale local branches deleted; the `docs/inventory-item-composition` branch's content was fully contained in PR #36.
- **Known small follow-ups:**
  - ConfirmStep in `app/src/routes/inventory/open.tsx` labels unit-mismatch children "merges into existing" (display-only issue).
  - E2E coverage for inventory flows is still zero.
  - `product_groups` deferred to v1.2; the Open Food Facts pipeline is still ahead.

## How this was verified

437 vitest tests green, `tsc` clean, migrations applied to the local stack, all four new RPCs exercised in psql end-to-end, staging schema verified via the management API.
