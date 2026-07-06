#!/usr/bin/env bash
# =============================================================================
# dev-stack.sh — boot the full InMan local dev stack in one command.
#
#   local Supabase (Docker) + migrations + seed + edge functions + Vite app,
#   optionally behind a Cloudflare tunnel for phone/camera testing.
#
# Clerk auth stays remote (the dev instance) — only the database/backend runs
# locally. See scripts/dev-stack.sh --help for flags, and supabase/seeds/README.md
# for how to author new seed profiles.
# =============================================================================
set -euo pipefail

# --- repo root (works from any CWD) -----------------------------------------
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$ROOT"

APP_DIR="$ROOT/app"
ENV_FILE="$APP_DIR/.env.local"
ENV_BAK="$APP_DIR/.env.local.bak"
SEEDS_DIR="$ROOT/supabase/seeds"
FUNCTIONS_ENV="$ROOT/supabase/.env.local"
APP_URL="http://localhost:5173"
STUDIO_URL="http://localhost:54323"

# --- pretty logging ----------------------------------------------------------
c_blue='\033[0;34m'; c_green='\033[0;32m'; c_yellow='\033[0;33m'; c_red='\033[0;31m'; c_dim='\033[2m'; c_off='\033[0m'
step() { printf "${c_blue}▸ %s${c_off}\n" "$*"; }
ok()   { printf "${c_green}✓ %s${c_off}\n" "$*"; }
warn() { printf "${c_yellow}! %s${c_off}\n" "$*"; }
die()  { printf "${c_red}✗ %s${c_off}\n" "$*" >&2; exit 1; }

# --- defaults / flags --------------------------------------------------------
SEED_SPEC="demo"
SEED_ITEMS=50
WANT_RESET=auto      # auto | yes | no
WANT_FUNCTIONS=true
WANT_TUNNEL=false
MODE=up              # up | down

usage() {
  cat <<'EOF'
dev-stack.sh — boot the InMan local dev stack (Supabase + functions + app).

USAGE
  scripts/dev-stack.sh [flags]
  npm run stack -- [flags]            # from app/

FLAGS
  --seed <spec>     Comma-list of seed profiles (default: demo).
                      none           catalog only (db reset --no-seed; no crew/inventory)
                      demo           the Demo Kitchen baseline (supabase/seed.sql)
                      <name>         apply supabase/seeds/<name>.sql after reset
                    Composable, e.g. --seed demo,bulk. 'none' cannot be combined.
  --seed-items N    Row count for parameterized profiles like 'bulk' (default: 50).
  --reset           Force `supabase db reset` (wipes data, re-applies migrations + seed).
  --no-reset        Never reset; only additively layer profiles onto the current volume.
  --no-functions    Don't serve edge functions.
  --tunnel          Expose the app over HTTPS via a Cloudflare quick tunnel.
  --down            Stop Supabase, restore app/.env.local from backup, and exit.
  -h, --help        Show this help.

EXAMPLES
  scripts/dev-stack.sh                                  # demo seed, functions, app
  scripts/dev-stack.sh --reset --seed demo,bulk --seed-items 200
  scripts/dev-stack.sh --reset --seed none
  scripts/dev-stack.sh --tunnel
  scripts/dev-stack.sh --down
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --seed)         SEED_SPEC="${2:?--seed needs a value}"; shift 2 ;;
    --seed=*)       SEED_SPEC="${1#*=}"; shift ;;
    --seed-items)   SEED_ITEMS="${2:?--seed-items needs a value}"; shift 2 ;;
    --seed-items=*) SEED_ITEMS="${1#*=}"; shift ;;
    --reset)        WANT_RESET=yes; shift ;;
    --no-reset)     WANT_RESET=no; shift ;;
    --no-functions) WANT_FUNCTIONS=false; shift ;;
    --tunnel)       WANT_TUNNEL=true; shift ;;
    --down)         MODE=down; shift ;;
    -h|--help)      usage; exit 0 ;;
    *)              die "unknown flag: $1 (see --help)" ;;
  esac
done

[[ "$SEED_ITEMS" =~ ^[0-9]+$ ]] || die "--seed-items must be a non-negative integer (got: $SEED_ITEMS)"

# --- parse seed spec into BASE (none|demo) + EXTRA profiles -------------------
BASE_SEED="demo"
SAW_NONE=false
SAW_DEMO=false
EXTRA_PROFILES=()
IFS=',' read -r -a _tokens <<< "$SEED_SPEC"
for t in "${_tokens[@]}"; do
  t="$(echo "$t" | tr -d '[:space:]')"
  [ -z "$t" ] && continue
  case "$t" in
    none) SAW_NONE=true ;;
    demo) SAW_DEMO=true ;;
    *)    EXTRA_PROFILES+=("$t") ;;
  esac
done
# 'none' is exclusive: rejected regardless of token order.
if [ "$SAW_NONE" = true ] && { [ "$SAW_DEMO" = true ] || [ "${#EXTRA_PROFILES[@]}" -gt 0 ]; }; then
  die "--seed none cannot be combined with demo or other profiles"
fi
[ "$SAW_NONE" = true ] && BASE_SEED="none"
# Validate extra profile files exist up front.
for p in "${EXTRA_PROFILES[@]:-}"; do
  [ -z "$p" ] && continue
  [ -f "$SEEDS_DIR/$p.sql" ] || die "unknown seed profile '$p': no $SEEDS_DIR/$p.sql (available: $(ls "$SEEDS_DIR"/*.sql 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\.sql$//' | paste -sd, - || echo none))"
done

# --- helpers -----------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || die "$1 not found on PATH — $2"; }

supabase_running() { supabase status >/dev/null 2>&1; }

status_value() {  # status_value <REGEX-of-var-name>
  printf '%s\n' "$STATUS_ENV" | grep -iE "^$1=" | head -1 | cut -d= -f2- | tr -d '"'
}

db_container() {
  docker ps --format '{{.Names}}' | grep -m1 '^supabase_db_' || true
}

apply_profile() {  # apply_profile <name>
  local name="$1" cid
  cid="$(db_container)"
  [ -n "$cid" ] || die "could not find the local Supabase DB container (is it running?)"
  step "Applying seed profile '$name' (seed-items=$SEED_ITEMS)…"
  docker exec -i -e PGOPTIONS= "$cid" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -v n="$SEED_ITEMS" \
    < "$SEEDS_DIR/$name.sql"
  ok "Profile '$name' applied"
}

# --- background process tracking + cleanup -----------------------------------
FUNCTIONS_PID=""
TUNNEL_PID=""
cleanup() {
  [ -n "$TUNNEL_PID" ]    && kill -- "-$TUNNEL_PID"    2>/dev/null || true
  [ -n "$FUNCTIONS_PID" ] && kill -- "-$FUNCTIONS_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# =============================================================================
# --down: stop everything and restore env, then exit
# =============================================================================
if [ "$MODE" = "down" ]; then
  step "Stopping local Supabase…"
  supabase stop || warn "supabase stop reported an error (was it running?)"
  if [ -f "$ENV_BAK" ]; then
    mv -f "$ENV_BAK" "$ENV_FILE"
    ok "Restored app/.env.local from backup"
  else
    warn "No app/.env.local.bak to restore (left .env.local as-is)"
  fi
  ok "Local stack down."
  exit 0
fi

# =============================================================================
# 1. Preflight
# =============================================================================
step "Preflight checks…"
need docker "install Docker Desktop and ensure the daemon is running"
need supabase "install the Supabase CLI (https://supabase.com/docs/guides/cli)"
need node "install Node.js 24+"
need npm "install npm (ships with Node.js)"
docker info >/dev/null 2>&1 || die "Docker daemon is not reachable — start Docker Desktop"
ok "docker, supabase, node, npm present; Docker daemon up"

if [ ! -d "$APP_DIR/node_modules" ]; then
  step "Installing app dependencies (npm ci)…"
  (cd "$APP_DIR" && npm ci)
  ok "Dependencies installed"
fi

# =============================================================================
# 2. Start Supabase (records whether it was already up)
# =============================================================================
if supabase_running; then
  ok "Supabase already running"
else
  step "Starting local Supabase (this can take a minute on first run)…"
  supabase start
  ok "Supabase started"
fi

# =============================================================================
# 3. Decide + run reset / seeding
# =============================================================================
# A fresh `supabase start` already applied migrations + the demo baseline seed.
# In 'auto' mode we never wipe an already-running stack — extra profiles are
# idempotent and layered additively. The only auto-reset is `--seed none`, whose
# whole intent is an empty DB. Pass --reset to rebuild a running stack on purpose.
DO_RESET=false
case "$WANT_RESET" in
  yes) DO_RESET=true ;;
  no)  DO_RESET=false ;;
  auto)
    if [ "$BASE_SEED" = "none" ]; then DO_RESET=true; fi
    ;;
esac

if [ "$DO_RESET" = true ]; then
  if [ "$BASE_SEED" = "none" ]; then
    step "Resetting DB (migrations only, no demo seed)…"
    supabase db reset --no-seed
  else
    step "Resetting DB (migrations + Demo Kitchen seed)…"
    supabase db reset
  fi
  ok "Database reset (base seed: $BASE_SEED)"
else
  ok "Reusing existing database (base seed: $BASE_SEED; pass --reset to rebuild)"
fi

# Layer extra profiles (idempotent — safe to re-apply).
for p in "${EXTRA_PROFILES[@]:-}"; do
  [ -z "$p" ] && continue
  apply_profile "$p"
done

# =============================================================================
# 4. Repoint app/.env.local at the local stack (preserve Clerk key)
# =============================================================================
step "Pointing app/.env.local at the local stack…"
STATUS_ENV="$(supabase status -o env 2>/dev/null || true)"
API_URL="$(status_value 'API_URL')"
PUB_KEY="$(status_value '[A-Z_]*PUBLISHABLE[A-Z_]*')"
[ -n "$PUB_KEY" ] || PUB_KEY="$(status_value 'ANON_KEY')"
[ -n "$API_URL" ] || die "could not read API_URL from 'supabase status -o env'"
[ -n "$PUB_KEY" ] || die "could not read a publishable/anon key from 'supabase status -o env'"

CLERK_KEY=""
if [ -f "$ENV_FILE" ]; then
  CLERK_KEY="$(grep -E '^VITE_CLERK_PUBLISHABLE_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
fi
[ -n "$CLERK_KEY" ] || warn "no VITE_CLERK_PUBLISHABLE_KEY found to preserve — fill it into app/.env.local before signing in"

if [ -f "$ENV_FILE" ] && [ ! -f "$ENV_BAK" ]; then
  cp "$ENV_FILE" "$ENV_BAK"
  ok "Backed up existing app/.env.local → app/.env.local.bak"
fi

cat > "$ENV_FILE" <<EOF
# Written by scripts/dev-stack.sh — points the app at the LOCAL Supabase stack.
# Your previous file is preserved at app/.env.local.bak; restore with --down.
VITE_CLERK_PUBLISHABLE_KEY=$CLERK_KEY
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$PUB_KEY
EOF
ok "app/.env.local → $API_URL"

# =============================================================================
# 5. Serve edge functions (background)
# =============================================================================
if [ "$WANT_FUNCTIONS" = true ]; then
  FN_ENV_ARG=()
  if [ -f "$FUNCTIONS_ENV" ]; then
    FN_ENV_ARG=(--env-file "$FUNCTIONS_ENV")
  else
    warn "supabase/.env.local missing — parse-receipt won't have ANTHROPIC_API_KEY"
  fi
  step "Serving edge functions…"
  setsid supabase functions serve "${FN_ENV_ARG[@]}" >"$ROOT/.dev-stack-functions.log" 2>&1 &
  FUNCTIONS_PID=$!
  ok "Edge functions serving (logs: .dev-stack-functions.log)"
fi

# =============================================================================
# 6. Cloudflare tunnel (optional, background)
# =============================================================================
TUNNEL_URL=""
if [ "$WANT_TUNNEL" = true ]; then
  CF_CMD=()
  if command -v cloudflared >/dev/null 2>&1; then
    CF_CMD=(cloudflared)
  elif command -v npx >/dev/null 2>&1; then
    warn "cloudflared not installed — falling back to 'npx cloudflared' (first run downloads it)"
    CF_CMD=(npx --yes cloudflared)
  else
    warn "cloudflared not installed and npx unavailable — skipping tunnel. Install: npm i -g cloudflared"
  fi
  if [ "${#CF_CMD[@]}" -gt 0 ]; then
    step "Starting Cloudflare tunnel…"
    setsid "${CF_CMD[@]}" tunnel --url "$APP_URL" >"$ROOT/.dev-stack-tunnel.log" 2>&1 &
    TUNNEL_PID=$!
    for _ in $(seq 1 30); do
      TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$ROOT/.dev-stack-tunnel.log" 2>/dev/null | head -1 || true)"
      [ -n "$TUNNEL_URL" ] && break
      sleep 1
    done
    [ -n "$TUNNEL_URL" ] && ok "Tunnel: $TUNNEL_URL" || warn "Tunnel URL not detected yet — check .dev-stack-tunnel.log"
  fi
fi

# =============================================================================
# 7. Summary banner + run the app (foreground)
# =============================================================================
SEED_LABEL="$BASE_SEED"
[ "${#EXTRA_PROFILES[@]}" -gt 0 ] && SEED_LABEL="$SEED_LABEL,$(IFS=,; echo "${EXTRA_PROFILES[*]}")"

printf "\n${c_green}── InMan local stack ──────────────────────────────${c_off}\n"
printf "  App        ${c_blue}%s${c_off}\n" "$APP_URL"
printf "  Studio     ${c_blue}%s${c_off}\n" "$STUDIO_URL"
[ "$WANT_FUNCTIONS" = true ] && printf "  Functions  ${c_blue}%s${c_off}\n" "$API_URL/functions/v1"
[ -n "$TUNNEL_URL" ] && printf "  Tunnel     ${c_blue}%s${c_off}\n" "$TUNNEL_URL"
printf "  Seed       %s\n" "$SEED_LABEL"
if [ "$BASE_SEED" = "demo" ]; then
  printf "  ${c_dim}Demo login: demo+clerk_test@tenacioustech.app / InManDemo!2026${c_off}\n"
fi
printf "${c_green}───────────────────────────────────────────────────${c_off}\n"
printf "${c_dim}Ctrl-C stops the app + functions/tunnel; Supabase stays up. Run --down to stop it.${c_off}\n\n"

step "Starting Vite dev server…"
npm run dev --prefix "$APP_DIR"
