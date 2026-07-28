import { defineConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Inline .env.test loader: pulls CLERK_* and VITE_* into process.env before
// Playwright spawns the dev server, so the smoke test can skip cleanly when
// E2E credentials aren't configured (no extra dotenv dependency).
const envPath = path.resolve(__dirname, '.env.test')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

// Dev-server port, most specific wins: an explicit PLAYWRIGHT_PORT, then the port
// this worktree reserved in .dev-port (written by scripts/new-worktree.sh), then
// Vite's default. Parallel worktrees each get their own port this way, so
// reuseExistingServer below can't silently attach one worktree's test run to
// another worktree's dev server. CI sets neither and lands on 5173 as before.
const portFile = path.resolve(__dirname, '../.dev-port')
const reservedPort = fs.existsSync(portFile)
  ? fs.readFileSync(portFile, 'utf8').trim()
  : ''
const rawPort = process.env.PLAYWRIGHT_PORT?.trim() || reservedPort || '5173'
const PORT = Number(rawPort)
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  // Failing loudly beats testing whatever happens to be on the fallback port.
  throw new Error(
    `Invalid dev-server port ${JSON.stringify(rawPort)} (from ${
      process.env.PLAYWRIGHT_PORT?.trim() ? 'PLAYWRIGHT_PORT' : portFile
    })`,
  )
}
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  // Sweeps the crews/users each run creates so staging + the Clerk dev instance
  // stay slim. Self-skips when SUPABASE_SERVICE_ROLE_KEY isn't configured.
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    // --strictPort so Vite fails loudly instead of drifting to the next free
    // port, which would leave baseURL pointing at nothing (same reasoning as
    // scripts/dev-stack.sh).
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
