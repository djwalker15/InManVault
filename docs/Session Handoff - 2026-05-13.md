# Session Handoff — 2026-05-13

> ⚠️ **Superseded by [[Session Handoff - 2026-07-29]]** — kept for history; read the newer note instead.

> Snapshot for the next Claude session picking up the InMan app. Read this
> after `docs/CLAUDE.md` and `docs/InMan Implementation Plan.md` — those
> are the authoritative product/architecture briefs; this doc is the thin
> "what's been happening lately and what's queued next" layer.

---

## State of the world

**MVP scope from the Implementation Plan is now fully shipped.** All six
listed journeys + their dependencies are live in the app at `app/`:

- Onboarding (Path A + B), Space Setup, Adding Inventory (manual),
  Checking Stock, Moving Items (single + put-back)
- Crew Management — every action from the journey doc: invite, change
  role, remove, permission overrides, transfer ownership, leave, request
  deletion with 48h cool-off, cancel deletion
- Space Reorganization — inline rename + reclassify + the four complex
  ops (move, merge, delete-with-items, split) behind a Reorganize mode

**Test state:** `npm run test:run` from `app/` is 54 files / 305 tests
green. Lint and `tsc --noEmit` are clean.

**DB state:** every migration in `supabase/migrations/` is applied to the
remote Supabase project `gewrsrbjkgffukzbnenl`. Use the Supabase MCP to
verify with `list_migrations` if in doubt.

---

## What landed this session

In approximate order. Commit hashes are stable references — see
`git show <hash>` for full diffs.

| Commit | What |
|--------|------|
| `4b3abae` | refactor(db): switch volume base unit from `ml` to `fl_oz` |
| `ffcc818` | feat(db): seed Tier 1 categories (20 globals) + 227-product starter catalog from the curator's kitchen CSV |
| `fae6c73` | docs(vault): add `InMan Implementation Plan.md`, refresh `docs/CLAUDE.md`, defer kiosk PIN to first kiosk use |
| `1c5a15d` | feat(crews): `/crew/settings` read shell — General + Members tabs (Permissions + Danger zone placeholdered) |
| `9ab3671` | feat(crews): Members tab actions — invite (inserts into `invites`), change role, remove, revoke pending invite |
| `7b0e33a` | feat(crews): Permissions tab — per-member feature overrides + new `set_member_permissions` RPC |
| `31f14e9` | feat(crews): Danger zone — transfer ownership, leave, schedule deletion with live 48h countdown |
| `81e9ebd` | test(spaces): backfill P6.1 reclassify + Premises-immutable coverage (behavior had shipped in P2.6) |
| `50af8cf` | feat(spaces): Reorganize mode shell + preview panel (`?mode=reorganize`) |
| `25aadd7` | feat(spaces): Reorganize Move + Merge — `move_space` + `merge_spaces` RPCs + live preview impact metrics |
| `0569020` | feat(spaces): Reorganize Delete + Split — `delete_space_with_items` + `split_space` RPCs + item-level pickers |

The session opened by **recovering an interrupted batch** from the
previous run — three uncommitted migrations were already applied to
remote (volume base, categories, products) but had no local commits and
the doc updates that paired with them were still dirty. The first three
commits in the table above are that batch.

---

## Patterns established this session that are easy to miss

### `crew_members` and `spaces` are mutated only through SECURITY DEFINER RPCs

`crew_members` has only an INSERT-owner-bootstrap policy and a SELECT
policy. There is **no UPDATE policy**. Every mutation routes through a
plpgsql RPC so the gating rule lives in one place. Same goes for
hierarchy mutations on `spaces` — direct UPDATEs only handle rename +
reclassify (`name`, `unit_type`); structural mutations go through RPCs.

RPCs added or used this session (all `SECURITY DEFINER`):

| RPC | Purpose |
|-----|---------|
| `change_member_role(crew_member_id, new_role)` | P5.4 |
| `remove_crew_member(crew_member_id)` | P5.4 |
| `leave_crew(crew_id)` | P5.6 (already existed) |
| `transfer_crew_ownership(crew_id, new_owner_user_id)` | P5.6 (already existed) |
| `request_crew_deletion(crew_id)` | P5.6 (already existed) |
| `cancel_crew_deletion(crew_id)` | P5.6 (already existed) |
| `set_member_permissions(crew_member_id, overrides jsonb)` | P5.5 (new) |
| `move_space(space_id, new_parent_id)` | P6.3 (new) |
| `merge_spaces(source_id, target_id)` | P6.3 (new) |
| `delete_space_with_items(space_id, items_target_id, clear_homes)` | P6.4 (new) |
| `split_space(space_id, new_name, item_ids[], child_space_ids[])` | P6.4 (new) |

When adding new mutations on these tables, default to the RPC pattern
unless you have a strong reason not to.

### `space_parent_allows_child` mirrors `ALLOWED_CHILD_TYPES`

`tree-helpers.ts` exports `unitTypeAllowsChild(parent, child)`. The DB
has a matching `public.space_parent_allows_child(parent_type, child_type)`
SQL function. Both are defined from the same rule (lower-rank child than
parent, premises is never a child, shelf is always a leaf). When you
edit one, edit the other. Tests at the helper level cover the matrix.

### Refetch-after-mutation tick

Pages that mutate-then-refresh use a local `refetchTick` state and pass
`onChanged: () => setRefetchTick((t) => t + 1)` down to children. The
`useEffect` that loads the page's data depends on `refetchTick`. This
beats threading explicit `reload()` callbacks through the tree and
keeps mutations near the components that own them. See
`app/src/routes/crew/settings.tsx` and `app/src/routes/spaces.tsx`.

### Query-param-driven sub-state

- `/crew/settings?tab=general|members|permissions|danger`
- `/spaces?mode=reorganize`

Both use `useSearchParams` with `replace: true` so the browser back
button restores the parent view rather than walking the tab/mode stack.

### Member name resolution is stubbed

Other crew members' Clerk IDs are masked to "Member · <last 6 chars>"
via `maskUserId`. The current user shows as "You". Real Clerk-based
name resolution (admin SDK call or a webhook-fed `user_profiles` table)
is queued but not in scope.

### Invite emails are not sent yet

The Members tab's invite flow inserts a row into `invites` with a
client-generated 32-hex-char code and surfaces the `/invite/<code>` URL
with a copy button. Email delivery is queued behind the MVP
`send_invite` edge function (mentioned in the Edge Function inventory in
`docs/CLAUDE.md`) but is not implemented.

### React-hooks/set-state-in-effect

The ESLint rule blocks `setX(...)` inside a `useEffect` body. The
established workaround is to derive the value via `useMemo`/`useState`
lazy initializer + a discriminator (e.g. `snapshot.crewId !== crewId`
on the settings page) rather than reset-on-effect. The reorganize
preview's per-member draft state uses the `key={selected.crew_member_id}`
remount trick — the parent re-keys the child when the picked row
changes, so a `useState(() => ({...initialOverrides}))` lazy init
reseeds without an effect.

---

## Known gaps / things flagged but not done

These are not blockers; they're places the next session might want to
pick up after deciding on a direction.

1. **Inline tree-editor Delete leaves items orphaned.** The Phase 2
   inline Delete (`tree-editor.tsx` → `onDelete` → bulk
   `update spaces set deleted_at`) only soft-deletes the Spaces
   themselves. Inventory items whose `current_space_id` points at a
   deleted node are now displaced but pointing nowhere meaningful.
   `delete_space_with_items` was built in P6.4 — the inline Delete
   action should route through it when the node (or its descendants)
   contain items.
2. **Real Clerk name resolution.** As above. Likely a small
   `user_profiles` table + Clerk webhook handler edge function.
3. **Invite email delivery.** `send_invite` edge function isn't built.
   Users currently copy/paste the invite URL out of the UI.
4. **Recursive delete in Space Reorganization.** `delete_space_with_items`
   intentionally re-parents children rather than offering "delete
   children too". The journey doc lists it as an option; users currently
   prune leaves first.
5. **Bulk reassign as a delete-item option.** Journey doc Operation 5
   mentions a "Bulk reassign" item-disposition that opens Moving Items
   Scenario 4. Not built — the current Delete panel only offers
   "Move to a target Space".
6. **`docs/CLAUDE.md` "Last updated" date.** Currently says "April 9,
   2026" but content covers everything through Phase 6. Not blocking
   — Implementation Plan is the live doc — but worth a refresh.

---

## Repo orientation cheat sheet

```
app/src/
├── routes/                  # one file per page
│   ├── crew/settings.tsx    # /crew/settings (P5.3+)
│   ├── crews.tsx            # /crews list (P5.2)
│   ├── spaces.tsx           # /spaces tree editor + ?mode=reorganize
│   ├── inventory.tsx        # /inventory list with alerts
│   ├── inventory/add.tsx    # /inventory/add product → item flow
│   ├── alerts.tsx           # /alerts grouped page
│   ├── dashboard.tsx        # /dashboard checklist hero
│   ├── onboarding/          # /onboarding/{decision,new,spaces}
│   └── …
├── components/
│   ├── ds/                  # DS primitives — Brand, Buttons, Field, Chip, HeroCard, NavHeader, ProgressBar, Sidenav, TipCard, etc.
│   ├── crew/                # Phase 5 — invite-form, member-row-actions, permissions-grid, danger-zone
│   ├── spaces/              # Phase 2 + Phase 6 — tree, tree-editor, tree-helpers, premises-form, template-browser, explainer, reorganize
│   ├── inventory/           # Phase 3 + 4 — list, search, row, restock, etc.
│   └── signed-in/           # Layout, sidenav-content, crew-switcher, bottom-nav, top-nav
├── lib/                     # supabase client, active-crew hook, utils
└── test/                    # vitest setup + clerk/supabase mocks

supabase/migrations/
├── 20260421_auth_slice…              # Phase 1 — users, crews, crew_members, invites
├── 20260429_phase2_spaces_slice…     # Phase 2 — spaces hierarchy + apply_template RPC
├── 20260429_phase3_inventory_slice…  # Phase 3 — products, items, flows, units, triggers
├── 20260501_phase4_record_transfer_rpc…
├── 20260501_unit_definitions_volume_base_fl_oz  # volume base swap
├── 20260501_categories_global_set    # Tier 1 categories
├── 20260501_products_starter_catalog # 227-product seed
├── 20260502_phase5_crew_management   # Phase 5 RPCs + role check
├── 20260502_phase5_crew_members_bootstrap_admin  # follow-up RLS
├── 20260506_phase5_set_member_permissions_rpc    # P5.5
├── 20260507_phase6_move_merge_space_rpcs         # P6.3
└── 20260507_phase6_delete_split_space_rpcs       # P6.4
```

---

## Suggested next move

After this session the obvious branches are:

- **v1.1 Waste** — the Implementation Plan's next horizon. Three
  journeys: Expiry Management → Logging Waste → Reviewing Waste History.
  Adds `waste_events` + the six reason-specific detail tables and the
  `log_waste` edge function. New territory, moderate scope.
- **Phase 6 wrap pass** — wire the inline tree-editor Delete to
  `delete_space_with_items` so items aren't orphaned. Small, contained,
  closes the "Known gaps" item #1 above.
- **Clerk name resolution** — small infrastructure piece that unblocks
  better UX on Members / Permissions / Danger Zone screens.

Pick one based on priority. The tests + lint hooks will tell you if you
break anything material; the Implementation Plan and the entity notes in
`docs/entities/` are the next layer of context after `docs/CLAUDE.md`.
