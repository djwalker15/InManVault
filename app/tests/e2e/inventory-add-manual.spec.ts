import { test, expect } from '@playwright/test'
import {
  haveE2eCreds,
  signUpAndCreateCrewWithPremises,
} from './helpers/onboard'

test.describe('Adding Inventory — Manual search/create', () => {
  test.skip(
    !haveE2eCreds,
    'Set CLERK_* and VITE_SUPABASE_* in app/.env.test to enable. See README.',
  )

  test('creates a custom product, adds it, then restocks it', async ({
    page,
  }) => {
    const { premisesName } = await signUpAndCreateCrewWithPremises(page)

    await page.goto('/inventory/add/manual')

    const productName = `E2E Manual ${Date.now()}`

    // --- First add: search (no match) → create custom → details form --------
    await page.getByLabel('Search for a product').fill(productName)
    await page
      .getByRole('button', { name: /create a custom product/i })
      .click()

    await page.getByPlaceholder('Heinz tomato paste').fill(productName)

    // Brand autocomplete is fed by a live query, so this is the only place the
    // real RLS + PostgREST path gets exercised — jsdom only ever sees a stub.
    const brandInput = page.getByLabel(/brand/i)
    const brandListId = await brandInput.getAttribute('list')
    expect(brandListId).toBeTruthy()
    const brandOptions = page.locator(`datalist#${brandListId} option`)
    // The seeded master catalog carries brands even for a brand-new crew.
    await expect.poll(() => brandOptions.count()).toBeGreaterThan(0)

    // A catalog brand typed in the wrong case snaps to the catalog spelling.
    const canonicalBrand = (await brandOptions.first().getAttribute('value'))!
    await brandInput.fill(canonicalBrand.toUpperCase())
    await brandInput.blur()
    await expect(brandInput).toHaveValue(canonicalBrand)

    await page.getByRole('button', { name: /^create product$/i }).click()

    // Details form: quantity (1) and unit (count) default; pick the Premises.
    await page
      .getByLabel('Current location')
      .selectOption({ label: premisesName })
    await page.getByRole('button', { name: /add to inventory/i }).click()

    await expect(page.getByText(`Added ${productName}.`)).toBeVisible()

    // --- Second pass: same product is now in inventory → restock branch -----
    await page.getByLabel('Search for a product').fill(productName)
    const restockThis = page.getByRole('button', { name: /restock this/i })
    await expect(restockThis).toBeVisible()
    await restockThis.click()

    // Restock form adds to the existing item (qty defaults to 1).
    await page.getByRole('button', { name: /^restock$/i }).click()

    await expect(
      page.getByText(/2 items added this session/i),
    ).toBeVisible()
  })
})
