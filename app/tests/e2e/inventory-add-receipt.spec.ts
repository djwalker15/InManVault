import { test, expect } from '@playwright/test'
import {
  haveE2eCreds,
  signUpAndCreateCrewWithPremises,
} from './helpers/onboard'

// A minimal but *valid* 1x1 PNG. The capture step decodes the upload with
// createImageBitmap before posting it; Chromium rejects a malformed PNG with
// "The source image could not be decoded", which would strand the flow on the
// capture step. (The previous literal had a truncated IDAT + bad CRC that PIL
// tolerated but the browser did not.)
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4UaEBAAN0AWnL+tDXAAAAAElFTkSuQmCC',
  'base64',
)

test.describe('Adding Inventory — Receipt scan', () => {
  test.skip(
    !haveE2eCreds,
    'Set CLERK_* and VITE_SUPABASE_* in app/.env.test to enable. See README.',
  )

  test('gates unresolved lines, then creates + imports them', async ({
    page,
  }) => {
    await signUpAndCreateCrewWithPremises(page)

    const stamp = Date.now()
    const alpha = `E2E Receipt Alpha ${stamp}`
    const bravo = `E2E Receipt Bravo ${stamp}`

    // Mock the vision/resolution edge function: a fresh crew has an empty
    // catalog, so both lines come back unresolved (no candidates) and must be
    // explicitly created before import — exercising the gate.
    // Mirror the edge function's CORS contract (supabase/functions/_shared/
    // cors.ts). supabase.functions.invoke POSTs cross-origin with a JSON
    // content-type + auth headers, so the browser fires a preflight first;
    // a fulfilled response without these headers fails the CORS check and
    // the invoke rejects — leaving the page stuck on the capture step.
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    await page.route('**/functions/v1/parse-receipt', (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: cors })
      }
      return route.fulfill({
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: 'E2E Mart',
          rows: [
            {
              raw_text: 'ALPHA RAW',
              canonical_name: alpha,
              brand: null,
              category: null,
              quantity: 3,
              unit: 'count',
              unit_price: 2.5,
              resolution: 'new',
              product_id: null,
              product_name: null,
              candidates: [],
              confidence: 0,
            },
            {
              raw_text: 'BRAVO RAW',
              canonical_name: bravo,
              brand: null,
              category: null,
              quantity: 1,
              unit: 'count',
              unit_price: null,
              resolution: 'new',
              product_id: null,
              product_name: null,
              candidates: [],
              confidence: 0,
            },
          ],
        }),
      })
    })

    await page.goto('/inventory/add/receipt')

    await page.getByLabel('Receipt photo').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    })

    // Preview shows both lines needing review. The CTA stays enabled
    // (submit-and-explain, not a silently dead button): clicking it while
    // no line is importable surfaces the blocked reason and imports nothing.
    // With *every* line unresolved, ready.length === 0 wins over the
    // "N lines still need review" branch in preview-step's handleImportClick.
    await expect(page.getByText(/2 need review/i)).toBeVisible()
    // The route seeds the space picker with the Premises root asynchronously;
    // wait for it so the click reports the review gate, not a missing space.
    await expect(page.getByLabel('Shelve everything to')).toHaveValue(/.+/)
    await page.getByRole('button', { name: /^Add /i }).click()
    await expect(page.getByRole('alert')).toHaveText(/nothing to add yet/i)

    // Explicitly create a product for each unresolved line.
    await page
      .getByRole('button', { name: new RegExp(`Create.*${alpha}`) })
      .click()
    await page
      .getByRole('button', { name: new RegExp(`Create.*${bravo}`) })
      .click()

    // Both resolved → the CTA reads "Add 2 items" → commit via the real RPC.
    const addButton = page.getByRole('button', { name: /add 2 items/i })
    await expect(addButton).toBeEnabled()
    await addButton.click()

    await expect(page.getByText(/imported 2 items\./i)).toBeVisible()
  })
})
