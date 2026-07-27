#!/usr/bin/env bash
# =============================================================================
# new-worktree.sh — spin up an isolated git worktree for a parallel session.
#
#   Branches off dev, copies the gitignored env files a checkout can't inherit,
#   installs app deps (which also re-installs the husky hooks), and reserves a
#   Vite dev-server port so two sessions never fight over one.
#
# Worktrees default to $HOME (native WSL filesystem) rather than a sibling of
# the repo on /mnt/c — node_modules installs and Vite watching are dramatically
# faster off the Windows mount. Override with --path or $INMAN_WORKTREE_HOME.
#
# See scripts/dev-stack.sh for booting the backend. Only ONE worktree should run
# dev-stack.sh: local Supabase is a single Docker stack per machine, keyed on the
# project_id in supabase/config.toml. Other worktrees run the app alone against it.
# =============================================================================
set -euo pipefail

# --- repo root (works from any CWD, including another worktree) --------------
ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$ROOT"

# Ports we must never hand out: 5173 is black-holed on this WSL box (Windows has
# something bound there and ss(8) can't see it), 5174 is dev-stack.sh's pinned
# port for whichever worktree owns the backend.
RESERVED_PORTS=(5173 5174)
PORT_MIN=5175
PORT_MAX=5250
PORT_FILE=".dev-port"

# Gitignored files a fresh worktree can't inherit, relative to the repo root.
ENV_FILES=(app/.env.local app/.env.test supabase/.env.local)

# Everything this script itself puts in a worktree. These read as untracked
# whenever their .gitignore rules haven't reached the base branch yet, so both
# the --rm dirty check and `git worktree remove` would refuse over copies that
# aren't work worth protecting.
OUR_FILES=("$PORT_FILE" "${ENV_FILES[@]}")

# --- pretty logging ----------------------------------------------------------
c_blue='\033[0;34m'; c_green='\033[0;32m'; c_yellow='\033[0;33m'; c_red='\033[0;31m'; c_dim='\033[2m'; c_off='\033[0m'
step() { printf "${c_blue}▸ %s${c_off}\n" "$*"; }
ok()   { printf "${c_green}✓ %s${c_off}\n" "$*"; }
warn() { printf "${c_yellow}! %s${c_off}\n" "$*"; }
die()  { printf "${c_red}✗ %s${c_off}\n" "$*" >&2; exit 1; }

# --- defaults / flags --------------------------------------------------------
SLICE=""
BRANCH=""
BASE="dev"
WT_PATH=""
WT_HOME="${INMAN_WORKTREE_HOME:-$HOME}"
PORT=""
WANT_FETCH=true
WANT_LOCAL=false
WANT_INSTALL=true
WANT_FORCE=false
MODE=add             # add | rm

usage() {
  cat <<'EOF'
new-worktree.sh — isolated worktree for a parallel Claude Code session.

USAGE
  scripts/new-worktree.sh <slice> [flags]
  scripts/new-worktree.sh <slice> --rm

FLAGS
  --branch <name>   Branch to create (default: feat/<slice>). Reused if it exists.
  --base <ref>      Branch to fork from (default: dev; prefers origin/<ref>).
  --path <dir>      Worktree location (default: $INMAN_WORKTREE_HOME/inman-<slice>,
                    where $INMAN_WORKTREE_HOME defaults to $HOME).
  --port N          Pin the dev-server port (default: next free >= 5175).
  --local           Fork from the LOCAL <base> instead of origin/<base>, for
                    branching off unpushed work. Accepts any local revision
                    (branch, tag, HEAD, SHA). Implies --no-fetch.
  --no-fetch        Skip `git fetch origin <base>`; origin/<base> is still
                    preferred if it exists (use --local to override that).
  --no-install      Skip `npm ci` in app/ (also skips husky hook setup).
  --rm              Remove the worktree for <slice>. Leaves the branch alone.
  --force           With --rm, discard uncommitted changes.
  -h, --help        Show this help.

EXAMPLES
  scripts/new-worktree.sh kiosk-pin
  scripts/new-worktree.sh receipt-parse --branch fix/receipt-parse --port 5180
  scripts/new-worktree.sh spike --base HEAD --local     # fork from where you are now
  scripts/new-worktree.sh kiosk-pin --rm
EOF
}

[ $# -gt 0 ] || { usage; exit 1; }
case "$1" in
  -h|--help) usage; exit 0 ;;
  -*)        die "first argument must be a slice name (see --help)" ;;
  *)         SLICE="$1"; shift ;;
esac

while [ $# -gt 0 ]; do
  case "$1" in
    --branch)     BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    --branch=*)   BRANCH="${1#*=}"; shift ;;
    --base)       BASE="${2:?--base needs a value}"; shift 2 ;;
    --base=*)     BASE="${1#*=}"; shift ;;
    --path)       WT_PATH="${2:?--path needs a value}"; shift 2 ;;
    --path=*)     WT_PATH="${1#*=}"; shift ;;
    --port)       PORT="${2:?--port needs a value}"; shift 2 ;;
    --port=*)     PORT="${1#*=}"; shift ;;
    --local)      WANT_LOCAL=true; shift ;;
    --no-fetch)   WANT_FETCH=false; shift ;;
    --no-install) WANT_INSTALL=false; shift ;;
    --rm)         MODE=rm; shift ;;
    --force)      WANT_FORCE=true; shift ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "unknown flag: $1 (see --help)" ;;
  esac
done

# Slice becomes a directory and (by default) a branch segment — keep it boring.
[[ "$SLICE" =~ ^[a-z0-9][a-z0-9._-]*$ ]] \
  || die "slice must be lowercase alphanumeric with . _ - (got: $SLICE)"
[ -n "$PORT" ] && { [[ "$PORT" =~ ^[0-9]+$ ]] || die "--port must be a port number (got: $PORT)"; }

[ -n "$BRANCH" ]  || BRANCH="feat/$SLICE"
[ -n "$WT_PATH" ] || WT_PATH="$WT_HOME/inman-$SLICE"

# =============================================================================
# --rm: unregister the worktree and exit
# =============================================================================
if [ "$MODE" = "rm" ]; then
  git worktree list --porcelain | sed -n 's/^worktree //p' | grep -qxF "$WT_PATH" \
    || die "no worktree registered at $WT_PATH (see: git worktree list)"

  DIRTY="$(git -C "$WT_PATH" status --porcelain \
    | grep -vxFf <(printf '?? %s\n' "${OUR_FILES[@]}") || true)"
  if [ "$WANT_FORCE" != true ] && [ -n "$DIRTY" ]; then
    die "$WT_PATH has uncommitted changes — commit them, or re-run with --force to discard"
  fi

  WT_BRANCH="$(git -C "$WT_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  step "Removing worktree $WT_PATH …"
  # Drop our own artifacts so git's untracked-file check doesn't trip on them and
  # force us into `git worktree remove --force`, which would also skip the checks
  # that actually matter.
  for f in "${OUR_FILES[@]}"; do rm -f "$WT_PATH/$f"; done
  if [ "$WANT_FORCE" = true ]; then
    git worktree remove --force "$WT_PATH"
  else
    git worktree remove "$WT_PATH"
  fi
  git worktree prune
  ok "Worktree removed (branch '$WT_BRANCH' left intact — delete it yourself once merged)"
  exit 0
fi

# =============================================================================
# 1. Preflight
# =============================================================================
step "Preflight checks…"
[ -e "$WT_PATH" ] && die "$WT_PATH already exists — pick another slice or --path"

# A branch can only be checked out in one worktree at a time; catch it here with
# a clearer message than git's.
EXISTING_WT="$(git worktree list --porcelain \
  | awk -v b="refs/heads/$BRANCH" '/^worktree /{p=substr($0,10)} $0=="branch "b{print p}')"
[ -n "$EXISTING_WT" ] && die "branch '$BRANCH' is already checked out at $EXISTING_WT"

# --local resolves entirely against local refs, so there's nothing to fetch.
[ "$WANT_LOCAL" = true ] && WANT_FETCH=false

if [ "$WANT_FETCH" = true ]; then
  step "Fetching origin/$BASE …"
  git fetch origin "$BASE" --quiet || warn "fetch failed — falling back to the local ref"
fi

if [ "$WANT_LOCAL" = true ]; then
  # ^{commit} so this accepts a branch, tag, HEAD, or raw SHA — not just a branch.
  git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null \
    || die "no local revision '$BASE' (--local never falls back to origin)"
  BASE_REF="$BASE"
# Otherwise prefer the remote-tracking ref, so a worktree starts from what's on
# GitHub rather than whatever the local branch happens to be sitting on.
elif git rev-parse --verify --quiet "origin/$BASE" >/dev/null; then
  BASE_REF="origin/$BASE"
  # Forking from origin while local work sits unpushed is the one case where the
  # default silently does the wrong thing — say so rather than let it surprise.
  if git rev-parse --verify --quiet "refs/heads/$BASE" >/dev/null; then
    AHEAD="$(git rev-list --count "origin/$BASE..$BASE" 2>/dev/null || echo 0)"
    [ "$AHEAD" -gt 0 ] && warn "local '$BASE' is $AHEAD commit(s) ahead of origin/$BASE — pass --local to fork from those instead"
  fi
elif git rev-parse --verify --quiet "$BASE" >/dev/null; then
  BASE_REF="$BASE"
  warn "no origin/$BASE — forking from the local '$BASE'"
else
  die "base ref '$BASE' not found locally or on origin"
fi
ok "Base: $BASE_REF ($(git rev-parse --short "$BASE_REF"))"

# =============================================================================
# 2. Create the worktree
# =============================================================================
if git rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null; then
  step "Checking out existing branch '$BRANCH' at $WT_PATH …"
  git worktree add "$WT_PATH" "$BRANCH"
else
  step "Creating branch '$BRANCH' off $BASE_REF at $WT_PATH …"
  git worktree add -b "$BRANCH" "$WT_PATH" "$BASE_REF"
fi
ok "Worktree ready: $WT_PATH"

# =============================================================================
# 3. Copy the gitignored env files
# =============================================================================
# These are snapshots taken now, not links — if the source .env.local later gets
# repointed (dev-stack.sh rewrites it), this copy keeps the old values.
step "Copying env files…"
COPIED=0
for f in "${ENV_FILES[@]}"; do
  if [ -f "$ROOT/$f" ]; then
    mkdir -p "$(dirname "$WT_PATH/$f")"
    cp "$ROOT/$f" "$WT_PATH/$f"
    printf "  ${c_dim}%s${c_off}\n" "$f"
    COPIED=$((COPIED + 1))
  else
    warn "$f missing in $ROOT — not copied"
  fi
done
ok "$COPIED env file(s) copied"

# =============================================================================
# 4. Reserve a dev-server port
# =============================================================================
# Two sources of truth, because neither alone is enough: ss(8) sees only ports
# bound right now, and .dev-port sees only worktrees that haven't started yet.
taken_ports() {
  ss -ltnH 2>/dev/null | awk '{print $4}' | sed 's/.*://'
  git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
    [ -f "$wt/$PORT_FILE" ] && cat "$wt/$PORT_FILE"
  done
  printf '%s\n' "${RESERVED_PORTS[@]}"
}

if [ -z "$PORT" ]; then
  step "Reserving a dev-server port…"
  TAKEN="$(taken_ports | grep -E '^[0-9]+$' | sort -un)"
  for p in $(seq "$PORT_MIN" "$PORT_MAX"); do
    grep -qx "$p" <<<"$TAKEN" || { PORT="$p"; break; }
  done
  [ -n "$PORT" ] || die "no free dev-server port in $PORT_MIN-$PORT_MAX"
fi
printf '%s\n' "$PORT" > "$WT_PATH/$PORT_FILE"
ok "Port $PORT reserved (recorded in $PORT_FILE)"

# =============================================================================
# 5. Install app deps (npm ci also runs husky via the 'prepare' script)
# =============================================================================
if [ "$WANT_INSTALL" = true ]; then
  step "Installing app dependencies (npm ci)…"
  (cd "$WT_PATH/app" && npm ci)
  ok "Dependencies installed; husky hooks wired to $WT_PATH/app/.husky"
else
  warn "Skipped npm ci — the pre-commit hook won't run until you install (core.hooksPath is app/.husky/_)"
fi

# =============================================================================
# 6. Summary banner
# =============================================================================
printf "\n${c_green}── InMan worktree: %s ──────────────────────${c_off}\n" "$SLICE"
printf "  Path       ${c_blue}%s${c_off}\n" "$WT_PATH"
printf "  Branch     %s ${c_dim}(off %s)${c_off}\n" "$BRANCH" "$BASE_REF"
printf "  Dev port   %s\n" "$PORT"
printf "${c_green}───────────────────────────────────────────────────${c_off}\n\n"

printf "${c_dim}Start a session there:${c_off}\n"
printf "  cd %s && claude\n\n" "$WT_PATH"
printf "${c_dim}Run the app against the shared local Supabase stack:${c_off}\n"
printf "  npm run dev --prefix app -- --port %s --strictPort\n\n" "$PORT"
printf "${c_dim}Backend: only ONE worktree should run scripts/dev-stack.sh — local Supabase is\n"
printf "a single Docker stack per machine, so a second --reset would wipe the first's data.\n\n"
printf "Playwright reads %s, so 'npm run test:e2e' here is already isolated on port %s.${c_off}\n" "$PORT_FILE" "$PORT"
