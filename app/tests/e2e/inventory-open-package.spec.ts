import { test, expect } from '@playwright/test'
import {
  haveE2eCreds,
  signUpAndCreateCrewWithPremises,
} from './helpers/onboard'

/**
 * Opening a Package (Feature 12): compose a package product with one
 * component, stock 2 sealed packs, then break one open through the wizard
 * (count → preview → cost → confirm). open_package writes the break event,
 * the package_break out-Flow and the package_yield in-Flow for real.
 */
test.describe('Inventory — create and open a package', () => {
  test.skip(
    !haveE2eCreds,
    'Set CLERK_* and VITE_SUPABASE_* in app/.env.test to enable. See README.',
  )

  test('composes a package and opens one pack into loose items', async ({
    page,
  }) => {
    const { premisesName } = await signUpAndCreateCrewWithPremises(page)
    const stamp = Date.now()

    // Seed a crew-private product to use as the component, so the package
    // form's product search has a deterministic hit (no catalog dependency).
    const componentName = `E2E Component ${stamp}`
    await page.goto('/inventory/add/quick')
    await page.getByLabel('What did you get?').fill(componentName)
    const addButton = page.getByRole('button', { name: /add to inventory/i })
    await expect(addButton).toBeEnabled()
    await addButton.click()
    await expect(page.getByText(`Added ${componentName}.`)).toBeVisible()

    // Compose: name, one component × 4, 2 sealed packs, stored at Premises.
    await page.goto('/inventory/add/package')
    await page.getByLabel(/package name/i).fill(`E2E Pack ${stamp}`)
    await page.getByLabel(/search products/i).fill(componentName)
    await page
      .getByRole('button', { name: new RegExp(componentName) })
      .first()
      .click()
    await page.getByLabel('Quantity per package').fill('4')
    await page.getByLabel(/sealed packs/i).fill('2')
    await page.getByLabel(/stored in/i).selectOption({ label: premisesName })
    const createButton = page.getByRole('button', { name: /create & open/i })
    await expect(createButton).toBeEnabled()
    await createButton.click()

    // The wizard: open 1 of 2, children resolve to new items, zero cost
    // reconciles trivially, confirm.
    await expect(
      page.getByRole('heading', { name: /open a package/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^preview$/i }).click()
    await expect(page.getByText(/store contents in/i)).toBeVisible()
    await page.getByRole('button', { name: /review cost/i }).click()
    const continueButton = page.getByRole('button', { name: /^continue$/i })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
    await expect(
      page.getByRole('list', { name: /children produced/i }),
    ).toContainText(componentName)
    await page.getByRole('button', { name: /^open package$/i }).click()

    await expect(
      page.getByRole('heading', { name: /package opened/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: /4 items added/i }),
    ).toBeVisible()

    // One sealed pack left; the component gained 4 loose units.
    await page.goto('/inventory')
    const list = page.getByRole('list', { name: 'Inventory items' })
    const pack = list.getByRole('button', { name: new RegExp(`E2E Pack ${stamp}`) })
    await expect(pack.getByText('1', { exact: true })).toBeVisible()
    const component = list.getByRole('button', { name: new RegExp(componentName) })
    await expect(component.getByText('5', { exact: true })).toBeVisible()
  })
})
