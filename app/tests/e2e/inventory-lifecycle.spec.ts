import { test, expect } from '@playwright/test'
import {
  haveE2eCreds,
  signUpAndCreateCrewWithPremises,
} from './helpers/onboard'

/**
 * Outbound inventory lifecycle — the four inline actions that write
 * non-purchase Flows: adjust (record_adjustment), use (record_consumption),
 * waste (record_waste) and remove (soft_delete_inventory_item). Every RPC
 * runs for real against the configured Supabase project; the e2e user owns
 * the crew, so the admin/owner-gated ones (adjust, remove) pass.
 *
 * Move / put-back need a second space and open-package needs a composed
 * product — both are out of scope here.
 */
test.describe('Inventory lifecycle — adjust, use, waste, remove', () => {
  test.skip(
    !haveE2eCreds,
    'Set CLERK_* and VITE_SUPABASE_* in app/.env.test to enable. See README.',
  )

  test('walks one item through adjust → use → waste → remove', async ({
    page,
  }) => {
    await signUpAndCreateCrewWithPremises(page)

    // Seed: quick-add 10 of a unique crew-private product.
    const productName = `E2E Lifecycle ${Date.now()}`
    await page.goto('/inventory/add/quick')
    await page.getByLabel('What did you get?').fill(productName)
    await page.getByLabel('Quantity').fill('10')
    const addButton = page.getByRole('button', { name: /add to inventory/i })
    await expect(addButton).toBeEnabled()
    await addButton.click()
    await expect(page.getByText(`Added ${productName}.`)).toBeVisible()

    // Expand the row; the details panel stays open across the refetch each
    // action triggers (expansion is keyed by item id, not by row index).
    await page.goto('/inventory')
    const list = page.getByRole('list', { name: 'Inventory items' })
    const row = list.getByRole('button', { name: new RegExp(productName) })
    await expect(row).toBeVisible()
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    const actions = page.getByRole('region', { name: 'Inventory actions' })
    // The quantity renders alone in its own element, so an exact-text match
    // can't collide with the timestamp digits in the product name.
    const quantity = (n: number) => row.getByText(String(n), { exact: true })
    await expect(quantity(10)).toBeVisible()

    // 1. Adjust: physical count says 12 (record_adjustment, +2).
    await actions.getByRole('button', { name: /^adjust$/i }).click()
    await page.getByLabel('Actual count on shelf').fill('12')
    await page.getByRole('button', { name: /^correct count$/i }).click()
    await expect(quantity(12)).toBeVisible()

    // 2. Use some: 2 consumed (record_consumption).
    await actions.getByRole('button', { name: /^use$/i }).click()
    await page.getByLabel('Quantity used').fill('2')
    await page.getByRole('button', { name: /^record use$/i }).click()
    await expect(quantity(10)).toBeVisible()

    // 3. Log waste: 1 lost, reason "Other" (record_waste + waste_other_details).
    await actions.getByRole('button', { name: /^log waste$/i }).click()
    await page.getByLabel('Quantity wasted').fill('1')
    await page.getByLabel('Reason').selectOption({ label: 'Other' })
    await page.getByLabel(/what happened\?/i).fill('e2e lifecycle probe')
    await page.getByRole('button', { name: /^log waste — deducts/i }).click()
    await expect(quantity(9)).toBeVisible()

    // 4. Remove: zero-out adjustment + tombstone (soft_delete_inventory_item).
    await actions.getByRole('button', { name: /^remove$/i }).click()
    await page.getByRole('button', { name: /^remove item$/i }).click()
    await expect(row).toHaveCount(0)
  })
})
