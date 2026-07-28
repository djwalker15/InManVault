#!/usr/bin/env node
// One-shot ETL: read docs/InMan_Kitchen_v5 - Sheet1.csv and emit a Supabase
// migration that seeds public.products with the master catalog.
//
//   Usage: node scripts/seed/build-starter-catalog.mjs
//
// Plain ESM .mjs so Node 20+ runs it directly with no build step. Re-run after
// editing the CSV or the category map below; output is deterministic.

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const CSV_PATH = path.join(REPO_ROOT, 'docs', 'InMan_Kitchen_v5 - Sheet1.csv')
const MIGRATION_TS = '20260501195500'
const MIGRATION_FILE = `${MIGRATION_TS}_products_starter_catalog.sql`
const MIGRATION_PATH = path.join(REPO_ROOT, 'supabase', 'migrations', MIGRATION_FILE)

// 20 documented globals — must match supabase/migrations/20260501194500_categories_global_set.sql.
const CATEGORIES = [
  'Produce', 'Dairy & Eggs', 'Meat & Poultry', 'Seafood',
  'Bakery & Bread', 'Grains & Pasta', 'Canned & Jarred', 'Condiments & Sauces',
  'Spices & Seasonings', 'Oils & Vinegars', 'Baking', 'Snacks',
  'Beverages', 'Frozen', 'Deli & Prepared',
  'Liquor', 'Beer', 'Wine', 'Mixers & Bar Supplies', 'Cleaning & Supplies',
]

// Hand-curated mapping from CSV `name` → category. Every CSV row's name must
// have an entry here; missing keys throw before the script writes any SQL.
// Keyed by name only — duplicate-name rows (e.g. three "Restaurant Style
// Salsa Medium" rows from different brands) all share the same category.
const CATEGORY_MAP = {
  // --- Snacks ---
  'Mango Cran Snack Medley': 'Snacks',
  'Mini Pretzel Twists Original': 'Snacks',
  'Fruit Snacks Berries & Cherries': 'Snacks',
  "Fruit 'n Yogurt Snacks Strawberry": 'Snacks',
  'Hard Candy Zero Sugar': 'Snacks',
  'Hard Candy Original': 'Snacks',
  'Craisins Dried Cranberries 50% Less Sugar': 'Snacks',
  'Dill Pickle Sunflower Seeds': 'Snacks',
  'Spicy Dill Pickle Sunflower Seeds': 'Snacks',
  'Dill Pickle Jumbo Sunflower Seeds': 'Snacks',
  'Duos Mango/Jalapeño Beef Jerky': 'Snacks',
  'Chile Lime Steak Slices': 'Snacks',
  'Dry Roasted Sunflower Kernels': 'Snacks',
  'Dry Roasted Peanuts Lightly Salted': 'Snacks',
  'Raw Whole Almonds': 'Snacks',
  'Roasted Unsalted Peanuts': 'Snacks',
  'Little Bites Blueberry Muffins': 'Snacks',
  'Little Bites Tropical Pineapple': 'Snacks',
  'Chocolate Squares Milk Choc Caramel Waffle Cone': 'Snacks',
  'Snickers Pecan': 'Snacks',
  'Turkish Moonbites': 'Snacks',
  'Chocolate Covered Espresso Beans': 'Snacks',
  'Original Popping Corn': 'Snacks',
  'Blueberry Crumble Granola': 'Snacks',
  'Mixed Berry Granola': 'Snacks',
  'Wildly Delicious Granola Triple Punch': 'Snacks',
  'Healthy Grains Peanut Butter Clusters Granola': 'Snacks',
  'Honey Roasted Pecans & Cranberries': 'Snacks',
  'Salad Topper Cranberries & Pecans': 'Snacks',
  'Salad Toppins Crunchy & Flavorful': 'Snacks',
  'Crispy Onions': 'Snacks',
  'Snack Olives Pitted Kalamata': 'Snacks',
  'Snack Olives Pitted Green with Garlic': 'Snacks',
  'Green Olive Bites Lemon & Thyme': 'Snacks',

  // --- Beverages ---
  'Breakfast Blend K-Cups': 'Beverages',
  'Classic Roast K-Cups': 'Beverages',
  'Cinnamon Bun K-Cups': 'Beverages',
  'Blueberry Bliss K-Cups': 'Beverages',
  'Caramel Coconut K-Cups Commemorative': 'Beverages',
  'Original Blend Ground Coffee': 'Beverages',
  'Iced Coffee Blend Vanilla K-Cups': 'Beverages',
  'Coffee Creamer Pods Caramel': 'Beverages',
  'Organic Awake English Breakfast Tea': 'Beverages',
  'Regenerative Organic Awake English Breakfast Black Tea': 'Beverages',
  'Passion Herbal Tea': 'Beverages',
  'Blackcurrant Burst Black Tea': 'Beverages',
  'Lemon Zinger Herbal Tea': 'Beverages',
  'Sleepytime Tea': 'Beverages',
  'Sleepytime Extra Tea': 'Beverages',
  'Ginger Peach Turmeric Herbal Tea': 'Beverages',
  'Organic Throat Coat Tea': 'Beverages',
  'Black Cask Bourbon Smoky Black Tea': 'Beverages',
  'Cherry Blossom Green Tea': 'Beverages',
  'Half & Half Iced Tea & Lemonade K-Cups': 'Beverages',
  'Clear Protein Strawberry Lemonade': 'Beverages',
  'Kencko Smoothie Powder': 'Beverages',
  'Energy Zero Sugar Sour Watermelon': 'Beverages',
  'Classic Root Beer Prebiotic Soda': 'Beverages',
  'Cherry Cola Prebiotic Soda': 'Beverages',
  'Tropical Punch Prebiotic Soda': 'Beverages',

  // --- Condiments & Sauces ---
  'Pineapple Pepper Sauce': 'Condiments & Sauces',
  'Mango Pepper Sauce': 'Condiments & Sauces',
  'Bahamian Tamarindo Hot Sauce': 'Condiments & Sauces',
  'Ponzu Sauce': 'Condiments & Sauces',
  'Louisiana Hot Sauce': 'Condiments & Sauces',
  'Tiger Sauce': 'Condiments & Sauces',
  'BBQ Sauce': 'Condiments & Sauces',
  'Original Teriyaki Marinade & Sauce': 'Condiments & Sauces',
  'Pepper Sauce': 'Condiments & Sauces',
  'Spicy Al Pastor Mexican-Style BBQ Sauce': 'Condiments & Sauces',
  'Spicy Chili Crisp': 'Condiments & Sauces',
  'Ole Garlic Crisp Dipping Sauce': 'Condiments & Sauces',
  'Natural Creamy Peanut Butter': 'Condiments & Sauces',
  'Traditional Basil Pesto': 'Condiments & Sauces',
  'Creamy Cajun-Inspired Cooking Sauce': 'Condiments & Sauces',
  'Butter Chicken Cooking Sauce': 'Condiments & Sauces',
  'Restaurant Style Salsa Medium': 'Condiments & Sauces',
  'Teriyaki Marinade': 'Condiments & Sauces',
  'Caribbean Jerk Marinade': 'Condiments & Sauces',
  'Hawaiian Style BBQ Marinade': 'Condiments & Sauces',
  'Brown Sugar Bourbon Marinade': 'Condiments & Sauces',
  'Mojito Lime Marinade': 'Condiments & Sauces',
  'Hawaiian Woodfire Grill Marinade': 'Condiments & Sauces',
  "Griller's Choice Marinade": 'Condiments & Sauces',
  'Worcestershire Sauce': 'Condiments & Sauces',
  'Classic Oil & Vinegar Dressing': 'Condiments & Sauces',
  'Balsamic Vinaigrette Dressing': 'Condiments & Sauces',
  'Hot Honey with Crisp Chili Dipping Sauce': 'Condiments & Sauces',
  'Simply Vinaigrette Caesar Dressing': 'Condiments & Sauces',
  'Classic Yellow Mustard': 'Condiments & Sauces',
  'Sandwich Pal Sweet & Spicy Mustard': 'Condiments & Sauces',
  'Pasta Sauce Flavored with Meat': 'Condiments & Sauces',
  'Hand Crafted Gochujang Sauce': 'Condiments & Sauces',
  "D'Yanya's Hot Sauce": 'Condiments & Sauces',
  'Sesame Teriyaki Sauce': 'Condiments & Sauces',
  'Garlic Pepper Sauce': 'Condiments & Sauces',
  'Mandarin Orange Sauce': 'Condiments & Sauces',
  'Smoked Chipotle Pepper Sauce': 'Condiments & Sauces',
  'Mongolian Garlic Sauce': 'Condiments & Sauces',
  'Original Hot Sauce': 'Condiments & Sauces',
  'Chili Lime Hot Sauce': 'Condiments & Sauces',
  'Raspberry Chipotle Barbecue Sauce': 'Condiments & Sauces',
  'Tomato Ketchup': 'Condiments & Sauces',
  'Hickory & Brown Sugar Barbecue Sauce': 'Condiments & Sauces',
  'Lemon Lime Hot Sauce': 'Condiments & Sauces',

  // --- Spices & Seasonings ---
  'Caribbean Jerk Wing Seasoning Mix': 'Spices & Seasonings',
  'Honey Pepper Chicken Seasoning': 'Spices & Seasonings',
  'Coarse Kosher Salt': 'Spices & Seasonings',
  'Coarse Black Pepper': 'Spices & Seasonings',
  'Granulated Black Pepper': 'Spices & Seasonings',
  'The Blend (Salt, Pepper & Garlic)': 'Spices & Seasonings',
  'Garlic Powder': 'Spices & Seasonings',
  'Whiskey Applewood Seasoning': 'Spices & Seasonings',
  'Black Cherry Chipotle Seasoning': 'Spices & Seasonings',
  'Onion Powder': 'Spices & Seasonings',
  'Oregano Leaves': 'Spices & Seasonings',
  'Ancho Chili Powder': 'Spices & Seasonings',
  'Grill Mates Chili Garlic Tri-Tip Seasoning': 'Spices & Seasonings',
  'Grill Mates Smokehouse Maple Seasoning': 'Spices & Seasonings',
  'Cinnamon Sticks': 'Spices & Seasonings',
  'Very Good Garlic All Purpose Seasoning': 'Spices & Seasonings',
  'Sunshine All Purpose Seasoning': 'Spices & Seasonings',
  'Smoked Paprika': 'Spices & Seasonings',
  'Salt-Free Lemon Pepper Seasoning': 'Spices & Seasonings',
  'Tajín Classic': 'Spices & Seasonings',
  'Tajín Twist': 'Spices & Seasonings',
  'Movie Theater Butter Salt Popcorn Seasoning': 'Spices & Seasonings',
  'Chile Limón Popcorn Seasoning': 'Spices & Seasonings',
  'Cajun Seasoning White Pepper Blend': 'Spices & Seasonings',
  'Cajun Seasoning Original Blend': 'Spices & Seasonings',
  'Original Creole Seasoning': 'Spices & Seasonings',
  'Premium Creole Seasoning': 'Spices & Seasonings',
  'Cajun Step Seasoning': 'Spices & Seasonings',
  'Sweet Cinnamon Heat Seasoning & Rub': 'Spices & Seasonings',
  'Hawaiian Chile Seasoning': 'Spices & Seasonings',
  'Chicken Rub Savory Garlic': 'Spices & Seasonings',
  'Hollywood Seasoning': 'Spices & Seasonings',

  // --- Canned & Jarred ---
  'Homestyle Baked Beans': 'Canned & Jarred',
  'Brown Sugar Hickory Baked Beans': 'Canned & Jarred',
  'Black Beans (Frijoles Negros)': 'Canned & Jarred',
  'French Style Green Beans No Salt Added': 'Canned & Jarred',
  'Whole Kernel Corn': 'Canned & Jarred',
  'Organic Chicken Broth': 'Canned & Jarred',
  'Hamburger Dill Chips': 'Canned & Jarred',
  'Sliced Manzanilla Olives': 'Canned & Jarred',

  // --- Grains & Pasta ---
  'Rice Sides Herb & Butter': 'Grains & Pasta',
  'Rice Sides Cilantro Lime Rice': 'Grains & Pasta',
  'Rice Sides Chicken Flavor': 'Grains & Pasta',
  'Rice Sides Mexican Style': 'Grains & Pasta',
  'Pasta Sides Chicken Flavor': 'Grains & Pasta',
  'Pasta Sides Creamy Garlic': 'Grains & Pasta',
  'Pasta Sides Teriyaki Noodles': 'Grains & Pasta',
  'Pasta Sides Parmesan': 'Grains & Pasta',
  'Garlic & Olive Oil Vermicelli': 'Grains & Pasta',
  'Red Beans & Rice': 'Grains & Pasta',
  'Creamy Blackened Chicken': 'Grains & Pasta',
  'Ready Rice Cilantro Lime': 'Grains & Pasta',
  '90 Second Jasmine Rice': 'Grains & Pasta',
  '90 Second Whole Grain Brown Rice': 'Grains & Pasta',
  'Yellow Rice': 'Grains & Pasta',
  'Basmati Rice': 'Grains & Pasta',
  'Brown Rice': 'Grains & Pasta',
  'Long Grain Brown Rice': 'Grains & Pasta',
  'Chickpea Curry with Steamed Rice': 'Grains & Pasta',
  'Spaghetti': 'Grains & Pasta',

  // --- Oils & Vinegars ---
  'Organic Apple Cider Vinegar Raw Unfiltered': 'Oils & Vinegars',
  'Organic Apple Cider Vinegar': 'Oils & Vinegars',
  'Apple Cider Vinegar': 'Oils & Vinegars',
  'White Wine Vinegar': 'Oils & Vinegars',
  'Red Wine Vinegar': 'Oils & Vinegars',
  'Rice Vinegar': 'Oils & Vinegars',
  'Extra Virgin Olive Oil': 'Oils & Vinegars',
  'Olive Oil Cooking Spray': 'Oils & Vinegars',

  // --- Baking ---
  'Stevia Leaf Sweetener Packets': 'Baking',
  'Kitchen Alchemy Citric Acid': 'Baking',
  'Organic Cane Sugar': 'Baking',
  'Pure Cane Light Brown Sugar': 'Baking',
  'Organic Blue Agave Sweetener': 'Baking',
  'Organic Raw Agave Nectar': 'Baking',
  'Organic Light Agave Nectar': 'Baking',
  'Organic Light Agave': 'Baking',
  'Organic Honey': 'Baking',
  'Local Texas Wildflower Honey': 'Baking',
  'Hot Honey': 'Baking',
  'Tuscan Blue Rosemary & Pepper Honey': 'Baking',
  'Lucky Lime Sea Salt Honey': 'Baking',
  'Blackland Prairie Wildflower Honey': 'Baking',

  // --- Mixers & Bar Supplies ---
  'Pineapple Puree Infused Syrup': 'Mixers & Bar Supplies',
  'Black Cherry Puree Infused Syrup': 'Mixers & Bar Supplies',
  '100% Lime Juice': 'Mixers & Bar Supplies',

  // --- Dairy & Eggs ---
  'Grated Parmesan Cheese': 'Dairy & Eggs',
  'Eggs': 'Dairy & Eggs',
  'Natural Cheese Sharp Cheddar Shredded': 'Dairy & Eggs',
  'Mexican-Style Classic Shredded Cheese': 'Dairy & Eggs',
  'Natural Cheese Sharp Cheddar Sliced 2% Milk': 'Dairy & Eggs',
  "Butter with Canola Oil": 'Dairy & Eggs',
  '2% Reduced Fat Milk Lactose Free': 'Dairy & Eggs',

  // --- Produce ---
  'Fresh Garlic': 'Produce',
  'Organic Spring Mix': 'Produce',
  'Tri-Pepper Mix': 'Produce',
  'Pineapple Spears': 'Produce',
  'Cara Cara Oranges': 'Produce',
  'Sweet & Juicy Navel Oranges': 'Produce',
  'Sun Beams Mandarins': 'Produce',
  'Organic Fresh Oregano': 'Produce',

  // --- Meat & Poultry ---
  'Organic Boneless Skinless Thin Sliced Chicken Breasts': 'Meat & Poultry',

  // --- Deli & Prepared ---
  'Oven Roasted Turkey Breast': 'Deli & Prepared',

  // --- Frozen ---
  'Frozen Cut Spinach': 'Frozen',
  'Fusions Veggie & Rice Sides Broccoli Rice Pilaf': 'Frozen',
  'Seasoned Asian Medley Steamfresh': 'Frozen',
  'Chicken Sausage Spinach Feta': 'Frozen',
  'Frozen Diced Chicken Breasts': 'Frozen',
  'Frozen Ricotta and Lemon Ravioli': 'Frozen',
  'Frozen Burger Patty': 'Frozen',
  'Frozen Meat': 'Frozen',
  'Frozen Mixed Fruit Blend': 'Frozen',
  'Caramel Cookie Crunch Mix-Ins Ice Cream': 'Frozen',
  'Watermelon Taffy Ice Cream': 'Frozen',
  'Veggie & Rice Sides Broccoli Rice Pilaf': 'Frozen',
  'Corn Cob Bites Street Style': 'Frozen',
  'Café Steamers Turkey Sausage Lasagna Bowl': 'Frozen',
  'Tapatio Salsa Roja Chicken Bowl': 'Frozen',
  'On Track High Protein Bowl': 'Frozen',
  'Boneless Skinless Chicken Breast': 'Frozen',
}

// Skip note-based size parsing when these patterns appear in notes — they
// indicate per-serving nutrition data that would be parsed as a fake pack size.
const SIZE_BLOCKLIST = [/\bprotein\b/i, /\bfiber\b/i, /\bcarb\b/i]

// --- Helpers ---

function parseSize(notes) {
  if (!notes) return null
  if (SIZE_BLOCKLIST.some((p) => p.test(notes))) return null
  const m = notes.match(/(\d+(?:\.\d+)?)\s*(fl[ _]?oz|oz|ml|L|kg|lbs?|g|count|ct|pkg)\b/i)
  if (!m) return null
  const value = parseFloat(m[1])
  const raw = m[2].toLowerCase().replace(/[ _]/g, '')
  const unit =
    raw === 'floz' ? 'fl_oz' :
    raw === 'oz'   ? 'oz' :
    raw === 'ml'   ? 'ml' :
    raw === 'l'    ? 'L' :
    raw === 'g'    ? 'g' :
    raw === 'kg'   ? 'kg' :
    raw === 'lbs' || raw === 'lb' ? 'lbs' :
    raw === 'ct' || raw === 'count' ? 'count' :
    raw === 'pkg'  ? 'pkg' : null
  return unit ? { value, unit } : null
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  return lines.map((line) => {
    const fields = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') inQuotes = false
        else cur += c
      } else if (c === ',') { fields.push(cur); cur = '' }
      else if (c === '"') inQuotes = true
      else cur += c
    }
    fields.push(cur)
    return fields
  })
}

const sqlText = (s) => (s == null || s === '' ? 'null' : `'${s.replace(/'/g, "''")}'`)
const sqlNum  = (n) => (n == null ? 'null' : String(n))

// --- Main ---

const csvText = fs.readFileSync(CSV_PATH, 'utf8')
const rows = parseCsv(csvText)
const [header, ...dataRows] = rows
if (header[0] !== 'name' || header[1] !== 'brand' || header[4] !== 'notes') {
  throw new Error(`Unexpected CSV header: ${header.join(',')}`)
}

const missing = new Set()
for (const r of dataRows) {
  const name = r[0]
  if (!(name in CATEGORY_MAP)) missing.add(name)
}
if (missing.size > 0) {
  console.error(`\nMissing category mappings (${missing.size}):`)
  for (const n of missing) console.error(`  - ${n}`)
  console.error('\nAdd entries to CATEGORY_MAP and re-run.')
  process.exit(1)
}

const valueRows = []
const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]))
const sizeStats = { parsed: 0, null: 0 }

for (const r of dataRows) {
  const [name, rawBrand, , , notes] = r
  const brand = (rawBrand ?? '').trim() || null
  const category = CATEGORY_MAP[name]
  counts[category]++
  const size = parseSize((notes ?? '').trim())
  if (size) sizeStats.parsed++; else sizeStats.null++
  const sizeValue = size?.value ?? null
  const sizeUnit  = size?.unit  ?? null
  valueRows.push(
    `(null, ${sqlText(name)}, ${sqlText(brand)}, ${sqlNum(sizeValue)}, ${sqlText(sizeUnit)}, ` +
    `(select category_id from public.categories where crew_id is null and name = ${sqlText(category)} and deleted_at is null), ` +
    `'seeded', null, null, null)`
  )
}

const sql = `-- Starter master catalog: ${dataRows.length} products derived from
-- docs/InMan_Kitchen_v5 - Sheet1.csv via scripts/seed/build-starter-catalog.mjs.
-- Re-run the script to regenerate after editing the CSV or category map.
--
-- All rows: crew_id = null (master catalog), source = 'seeded',
-- created_by = null, barcode = null, image_url = null. Sizes are parsed from
-- the CSV notes column when an unambiguous "<num> <unit>" pattern is present.

insert into public.products (
  crew_id, name, brand, size_value, size_unit,
  default_category_id, source, barcode, image_url, deleted_at
) values
${valueRows.map((v, i) => '  ' + v + (i === valueRows.length - 1 ? ';' : ',')).join('\n')}
`

fs.writeFileSync(MIGRATION_PATH, sql)

console.log(`Wrote ${MIGRATION_FILE}`)
console.log(`Rows: ${dataRows.length}  (sized: ${sizeStats.parsed}, unsized: ${sizeStats.null})`)
console.log('Per-category counts:')
for (const c of CATEGORIES) {
  console.log(`  ${c.padEnd(22)} ${counts[c]}`)
}
