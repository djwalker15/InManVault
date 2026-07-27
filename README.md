# InMan

Inventory management for crews — track what you have, where it lives, and how it flows in and out.

This repository holds the product end to end: the live frontend, the database schema, the design vault, and the design-system handoff. `docs/CLAUDE.md` is the authoritative project brief (architecture, data model, journeys) — read it before changing anything structural.

## Repo layout

| Path | What it is |
|---|---|
| `app/` | Live frontend — Vite 8, React 19, TypeScript, React Router v7, Clerk v5, Supabase JS v2, Tailwind v4 |
| `supabase/` | Canonical schema (`migrations/`), edge functions (`functions/`), project config (`config.toml`) |
| `site/` | Product/marketing site (Astro) with release announcements *(Phase 8 — not yet created)* |
| `docs/` | Obsidian vault — design + product source of truth (`docs/CLAUDE.md` first) |
| `inman-design-system/` | Read-only design handoff bundle; tokens mirrored into `app/src/index.css` |

## Environments

| Environment | Git branch | Supabase | Clerk | Cloudflare Pages | URL |
|---|---|---|---|---|---|
| Staging | `dev` | `staging` branch of `gewrsrbjkgffukzbnenl` | dev instance (`pk_test`) | `inman-app-staging` | `inman-staging.tenacioustech.app` |
| Production | `main` | `gewrsrbjkgffukzbnenl` | production instance (`pk_live`) | `inman-app` | product domain (TBD) |
| Product site | `main` (`site/**`) | — | — | `inman-site` | TBD |

- Every push to `dev` deploys to staging (migrations → edge functions → app). Every push to `main` deploys to production behind a **manual approval gate** (GitHub `production` environment).
- `VITE_*` values are baked at build time from GitHub environment variables — Cloudflare dashboard env vars are not used.
- Migrations flow staging → prod **via git**: the same `supabase/migrations/*.sql` files soak on staging, then apply to prod when `dev` merges to `main`. Never use the Supabase dashboard "merge branch" button.

### Demo seed data

Non-prod environments are populated by `supabase/seed.sql` — an idempotent "Demo Kitchen" crew (spaces + inventory + flows) so features render without hand-onboarding. It runs automatically on `supabase db reset` and on new Supabase branch creation; **it never runs on prod** (prod deploys use `db push`, which doesn't run seeds). To (re-)apply it to an existing branch, execute the file against that branch's database — e.g. `psql "$DB_URL" -f supabase/seed.sql`.

The demo crew is owned by a dedicated Clerk dev-instance login — **`demo+clerk_test@tenacioustech.app`** (password `InManDemo!2026`) — and also lists the repo owner's primary account as an admin member, so it's visible on a normal staging sign-in too.

## Local setup

App against a remote (staging) Supabase — lightest path:

```sh
cd app
cp .env.example .env.local   # fill in Clerk + Supabase dev keys
npm ci
npm run dev
```

### One-command local stack

To run the **whole stack locally** — Supabase (Postgres/PostgREST/Studio in Docker) + migrations +
seed + edge functions + the Vite app — use `scripts/dev-stack.sh` (needs Docker + the Supabase CLI;
Clerk auth stays on the remote dev instance). It boots Supabase, repoints `app/.env.local` at the
local stack (backing up your existing file, preserving your Clerk key), serves the edge functions, and
starts the dev server:

```sh
scripts/dev-stack.sh                                   # default: Demo Kitchen seed + functions + app
npm run stack --prefix app -- --tunnel                 # same, exposed over HTTPS via a Cloudflare tunnel
scripts/dev-stack.sh --reset --seed demo,bulk --seed-items 200   # + 200 bulk inventory items
scripts/dev-stack.sh --reset --seed none               # catalog only, no crew/inventory
scripts/dev-stack.sh --down                            # stop Supabase + restore app/.env.local
```

Ctrl-C stops the app, functions, and tunnel; Supabase keeps running (use `--down` to stop it). Seed
profiles are configurable and extensible — see [`supabase/seeds/README.md`](supabase/seeds/README.md)
for the available profiles and how to author your own. Run `scripts/dev-stack.sh --help` for all flags.

### Parallel worktrees

To work on several branches at once (e.g. one agent session per branch), `scripts/new-worktree.sh`
creates an isolated worktree off `dev`, copies the gitignored env files a fresh checkout can't inherit
(`app/.env.local`, `app/.env.test`, `supabase/.env.local`), runs `npm ci` (which re-wires the husky
hooks), and reserves a free Vite port so two sessions never collide:

```sh
scripts/new-worktree.sh kiosk-pin                      # → ~/inman-kiosk-pin on feat/kiosk-pin
scripts/new-worktree.sh receipt-parse --branch fix/receipt-parse --port 5180
scripts/new-worktree.sh kiosk-pin --rm                 # remove the worktree (branch left intact)
```

Worktrees land in `$HOME` by default (native WSL filesystem — far faster than `/mnt/c` for
`node_modules` and file watching); override with `--path` or `$INMAN_WORKTREE_HOME`.

Two things stay singletons across worktrees. **Local Supabase** is one Docker stack per machine (keyed
on `project_id` in `supabase/config.toml`), so only one worktree should run `dev-stack.sh` — the others
run `npm run dev --prefix app -- --port <reserved> --strictPort` against it, and a `--reset` from either
wipes shared data. **Playwright** pins port 5173 with `reuseExistingServer`, so run `test:e2e` in one
worktree at a time.

Tests: `npm run test` (vitest watch), `npm run test:run` (single pass), `npm run test:e2e` (Playwright; needs real creds in `app/.env.test`, skips without them). Pre-commit runs eslint + `vitest related` on staged files via husky.

## Releases

Conventional Commits drive everything: merges to `main` feed [release-please](https://github.com/googleapis/release-please), which maintains a release PR (version bump + `app/CHANGELOG.md`). Merging that PR tags `inman-vX.Y.Z`, publishes a GitHub Release, and rebuilds the product site's What's New page.

Commit style: `feat(scope): …`, `fix(scope): …`, `chore(scope): …` — `feat`/`fix` are what show up in client-facing release notes.

## CI/CD reference

Workflows live in `.github/workflows/`:

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | PRs to `dev`/`main`; called by deploys | lint, typecheck, vitest, build |
| `deploy-staging.yml` | push to `dev` | Supabase config/db/functions → staging branch, app → CF Pages staging |
| `deploy-prod.yml` | push to `main` (approval-gated) | same, against production |
| `release-please.yml` | push to `main` | release PR / GitHub Releases / changelog |
| `deploy-site.yml` | `site/**` or changelog changes on `main` | product site → CF Pages |
| `e2e.yml` | after staging deploys + nightly | Playwright smoke against staging |

Secrets/vars live in GitHub repo settings (repo-level: Supabase access token + Cloudflare token/account; per-environment: Supabase refs/URLs/keys and Clerk keys). The rollout plan and runbook details are tracked in ClickUp under **Work → InMan → 🚀 Infra & Releases**.
