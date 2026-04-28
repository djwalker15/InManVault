import { test, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

const haveClerkCreds =
  !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY
const haveSupabaseCreds =
  !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_PUBLISHABLE_KEY

test.describe('auth flow smoke', () => {
  test.skip(
    !haveClerkCreds || !haveSupabaseCreds,
    'Set CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY in app/.env.test to enable. See README.',
  )

  test('sign-up → onboarding → dashboard', async ({ page }) => {
    await setupClerkTestingToken({ page })

    // Clerk test instances auto-verify any address ending in +clerk_test@example.com
    // with the fixed code 424242.
    const email = `e2e-${Date.now()}+clerk_test@example.com`

    await page.goto('/sign-up')
    await page.getByPlaceholder('name@company.com').fill(email)
    await page.getByPlaceholder('••••••••').fill('e2e-password-A123!')
    await page.getByRole('button', { name: /create account/i }).click()

    await page.getByPlaceholder('123456').fill('424242')
    await page.getByRole('button', { name: /^verify$/i }).click()

    await expect(page).toHaveURL(/\/onboarding/)

    await page.getByPlaceholder(/walker home/i).fill('E2E Test Crew')
    await page.getByRole('button', { name: /create crew/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: /welcome,/i })).toBeVisible()
  })
})
