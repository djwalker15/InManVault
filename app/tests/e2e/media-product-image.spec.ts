import { test, expect } from '@playwright/test'
import {
  haveE2eCreds,
  signUpAndCreateCrewWithPremises,
} from './helpers/onboard'

// A minimal but *valid* 1x1 PNG — the upload path runs the file through
// downscaleToBlob, whose createImageBitmap rejects malformed PNGs with
// "The source image could not be decoded" (see the receipt spec).
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4UaEBAAN0AWnL+tDXAAAAAElFTkSuQmCC',
  'base64',
)

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

test.describe('Media — product image upload + thumbnail render', () => {
  test.skip(
    !haveE2eCreds,
    'Set CLERK_* and VITE_SUPABASE_* in app/.env.test to enable. See README.',
  )

  test('uploads a crew product photo and renders its signed thumbnail', async ({
    page,
  }) => {
    const { premisesName } = await signUpAndCreateCrewWithPremises(page)

    // Storage is the only mocked layer — product insert, image_url patch,
    // and the add-to-inventory RPC all run for real against staging.
    // supabase-js storage calls are cross-origin fetches with auth + JSON
    // headers, so every fulfilled route needs the CORS contract (house
    // convention — see the receipt spec).
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, cache-control, x-upsert',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    }

    let uploadedPath: string | null = null

    // Upload: POST /storage/v1/object/crew-media/<path>
    await page.route('**/storage/v1/object/crew-media/**', (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: cors })
      }
      if (req.method() === 'POST') {
        uploadedPath = decodeURIComponent(
          new URL(req.url()).pathname.split('/storage/v1/object/crew-media/')[1] ?? '',
        )
        return route.fulfill({
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ Key: `crew-media/${uploadedPath}` }),
        })
      }
      return route.fulfill({ status: 405, headers: cors })
    })

    // Signed URLs: POST /storage/v1/object/sign/crew-media (batch mint,
    // body { expiresIn, paths }) and GET .../sign/crew-media/<path>?token=…
    // (the minted URL the <img> then loads — serve the PNG bytes).
    await page.route('**/storage/v1/object/sign/crew-media**', (route) => {
      const req = route.request()
      if (req.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: cors })
      }
      if (req.method() === 'POST') {
        const { paths } = req.postDataJSON() as { paths: string[] }
        return route.fulfill({
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify(
            paths.map((path) => ({
              error: null,
              path,
              // storage-js prefixes this with `${SUPABASE_URL}/storage/v1`
              // to build the browser-facing signedUrl.
              signedURL: `/object/sign/crew-media/${path}?token=e2e-mock`,
            })),
          ),
        })
      }
      // GET of a minted URL → the image bytes.
      return route.fulfill({
        status: 200,
        headers: { ...cors, 'Content-Type': 'image/png' },
        body: PNG_1X1,
      })
    })

    await page.goto('/inventory/add/manual')

    const productName = `E2E Media ${Date.now()}`

    // Search (no match) → create custom product with a photo attached.
    await page.getByLabel('Search for a product').fill(productName)
    await page.getByRole('button', { name: /create a custom product/i }).click()
    await page.getByPlaceholder('Heinz tomato paste').fill(productName)
    await page.getByLabel(/add a photo/i).setInputFiles({
      name: 'product.png',
      mimeType: 'image/png',
      buffer: PNG_1X1,
    })
    await page.getByRole('button', { name: /^create product$/i }).click()

    // Details form appears once the insert + upload + image_url patch have
    // run; land the item in inventory via the real RPC.
    await page
      .getByLabel('Current location')
      .selectOption({ label: premisesName })
    await page.getByRole('button', { name: /add to inventory/i }).click()
    await expect(page.getByText(`Added ${productName}.`)).toBeVisible()

    // The object landed at <crew_id>/products/<product_id>/<uuid>.jpg.
    expect(uploadedPath).toMatch(
      new RegExp(`^${UUID}/products/${UUID}/${UUID}\\.jpg$`),
    )

    // The inventory list resolves the stored path through the (mocked)
    // batched mint and renders the signed URL as the row thumbnail.
    await page.goto('/inventory')
    const thumb = page.locator(`img[src*="token=e2e-mock"]`).first()
    await expect(thumb).toBeVisible()
    await expect(thumb).toHaveAttribute(
      'src',
      new RegExp(`/storage/v1/object/sign/crew-media/${uploadedPath}`),
    )
  })
})
