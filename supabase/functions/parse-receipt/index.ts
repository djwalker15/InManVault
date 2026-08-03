// parse-receipt
//
// Backs the "Scan receipt/invoice" add method (Journey "Adding Inventory"
// — Method 5). Turns a photographed receipt/invoice into resolved line
// items the client can confirm and import via bulk_import_inventory.
//
// The Anthropic API key lives only here (never in the browser), which is
// the whole reason this is an edge function rather than client code.
//
// Sequence:
//   1. Validate the user's Clerk JWT (forwarded as Authorization: Bearer).
//   2. Claude vision pass — extract purchasable line items, expanding the
//      receipt's abbreviated text into a clean canonical product name.
//   3. Per line, resolve to a catalog product through a confidence funnel:
//        a. product_aliases exact lookup (learned from prior receipts),
//        b. else trigram candidates via search_products_fuzzy,
//        c. else a single Claude disambiguation pass over all remaining
//           lines + their candidate shortlists.
//   4. Return resolved rows; the client gates ambiguous/new rows behind an
//      explicit pick/create before import.
//
// Deploy with `verify_jwt: false` — same rationale as the other functions:
// Clerk-signed JWTs don't validate against Supabase's native gateway
// secret, so we accept at the gateway and let PostgREST (which trusts
// Clerk) enforce RLS when the user-context client runs queries.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
const receiptModel = Deno.env.get('RECEIPT_MODEL') ?? 'claude-sonnet-4-6'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
// Above this disambiguation confidence we pre-select the product; below it
// the row is "ambiguous" and the user picks from candidates.
const MATCH_CONFIDENCE = 0.75
const CANDIDATE_LIMIT = 5

// Mirrors the unit_definitions seed — the only units the client accepts.
const KNOWN_UNITS = [
  'g',
  'kg',
  'oz',
  'lbs',
  'ml',
  'L',
  'tsp',
  'tbsp',
  'cup',
  'fl_oz',
  'gal',
  'count',
  'pkg',
] as const

// Receipts abbreviate units in a handful of predictable ways. Map those to
// unit_definitions values (label only — never rescale the quantity); pass
// anything still unknown through untouched so the client flags the row for
// review instead of silently coercing it.
const UNIT_ALIASES: Record<string, string> = {
  ea: 'count',
  each: 'count',
  ct: 'count',
  dz: 'count',
  lb: 'lbs',
  gallon: 'gal',
  'fl oz': 'fl_oz',
  floz: 'fl_oz',
}

function normalizeUnit(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const alias = UNIT_ALIASES[lower]
  if (alias) return alias
  // Case-insensitive match against the known units (OZ → oz, l → L, …).
  const known = KNOWN_UNITS.find((u) => u.toLowerCase() === lower)
  return known ?? trimmed
}

type Resolution = 'matched' | 'ambiguous' | 'new'

interface RequestBody {
  image?: string // base64, no data: prefix
  mime?: string // e.g. image/jpeg
  crew_id?: string
  merchant?: string | null
}

interface ExtractedItem {
  raw_text: string
  canonical_name: string
  brand?: string | null
  category?: string | null
  quantity?: number | null
  unit?: string | null
  unit_price?: number | null
}

interface Candidate {
  product_id: string
  name: string
  brand: string | null
}

interface ResolvedRow {
  raw_text: string
  canonical_name: string
  brand: string | null
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  resolution: Resolution
  product_id: string | null
  product_name: string | null
  candidates: Candidate[]
  confidence: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }
  if (!anthropicKey) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { error: 'Missing or malformed Authorization header' },
      401,
    )
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const image = body.image?.trim()
  const mime = body.mime?.trim() || 'image/jpeg'
  const crewId = body.crew_id?.trim()
  if (!image) {
    return jsonResponse({ error: 'image (base64) is required' }, 400)
  }
  if (!crewId) {
    return jsonResponse({ error: 'crew_id is required' }, 400)
  }

  // User-context client — forwards the Clerk JWT so RLS scopes alias
  // lookups and the fuzzy-search RPC to the caller's crew.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ---- 1. Vision extraction ------------------------------------------------
  let items: ExtractedItem[]
  let merchant: string | null = body.merchant ?? null
  try {
    const extracted = await extractLineItems(image, mime)
    items = extracted.line_items
    merchant = merchant ?? extracted.merchant ?? null
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Receipt parsing failed' },
      502,
    )
  }
  if (!items.length) {
    return jsonResponse({ merchant, rows: [] }, 200)
  }

  // ---- 2a. Alias lookup (learned from prior receipts) ----------------------
  const normalized = items.map((it) => normalize(it.raw_text))
  const aliasByRaw = new Map<string, string>() // raw_text -> product_id
  {
    const { data } = await supabase
      .from('product_aliases')
      .select('raw_text, product_id')
      .eq('crew_id', crewId)
      .in('raw_text', Array.from(new Set(normalized)))
    for (const row of (data ?? []) as { raw_text: string; product_id: string }[]) {
      aliasByRaw.set(row.raw_text, row.product_id)
    }
  }

  // ---- 2b. Trigram candidates for the lines without an alias hit -----------
  const candidatesByIndex = new Map<number, Candidate[]>()
  await Promise.all(
    items.map(async (it, i) => {
      if (aliasByRaw.has(normalized[i])) return
      const query = it.canonical_name || it.raw_text
      const { data } = await supabase.rpc('search_products_fuzzy', {
        p_crew_id: crewId,
        p_query: query,
        p_limit: CANDIDATE_LIMIT,
      })
      const cands = (data ?? []) as {
        product_id: string
        name: string
        brand: string | null
      }[]
      candidatesByIndex.set(
        i,
        cands.map((c) => ({
          product_id: c.product_id,
          name: c.name,
          brand: c.brand,
        })),
      )
    }),
  )

  // ---- 2c. One LLM disambiguation pass over the candidate lines ------------
  // Only lines that actually have candidates need a decision.
  const toDisambiguate = items
    .map((it, i) => ({ it, i }))
    .filter(({ i }) => (candidatesByIndex.get(i)?.length ?? 0) > 0)
  const choiceByIndex = new Map<number, { product_id: string | null; confidence: number }>()
  if (toDisambiguate.length > 0) {
    try {
      const choices = await disambiguate(
        toDisambiguate.map(({ it, i }) => ({
          index: i,
          raw_text: it.raw_text,
          canonical_name: it.canonical_name,
          candidates: candidatesByIndex.get(i) ?? [],
        })),
      )
      for (const c of choices) {
        choiceByIndex.set(c.index, {
          product_id: c.product_id || null,
          confidence: c.confidence,
        })
      }
    } catch {
      // Disambiguation is best-effort: on failure every candidate line
      // falls through to "ambiguous" so the user still picks manually.
    }
  }

  // Resolve display names for alias hits + chosen products in one query.
  const resolvedIds = new Set<string>()
  for (const pid of aliasByRaw.values()) resolvedIds.add(pid)
  for (const choice of choiceByIndex.values()) {
    if (choice.product_id) resolvedIds.add(choice.product_id)
  }
  const nameById = new Map<string, string>()
  if (resolvedIds.size > 0) {
    const { data } = await supabase
      .from('products')
      .select('product_id, name')
      .in('product_id', Array.from(resolvedIds))
    for (const p of (data ?? []) as { product_id: string; name: string }[]) {
      nameById.set(p.product_id, p.name)
    }
  }

  // ---- 3. Assemble resolved rows -------------------------------------------
  const rows: ResolvedRow[] = items.map((it, i) => {
    const candidates = candidatesByIndex.get(i) ?? []
    const base = {
      raw_text: it.raw_text,
      canonical_name: it.canonical_name,
      brand: it.brand ?? null,
      category: it.category ?? null,
      quantity: typeof it.quantity === 'number' ? it.quantity : null,
      unit: normalizeUnit(it.unit),
      unit_price: typeof it.unit_price === 'number' ? it.unit_price : null,
      candidates,
    }

    const aliasPid = aliasByRaw.get(normalized[i])
    if (aliasPid) {
      return {
        ...base,
        resolution: 'matched' as const,
        product_id: aliasPid,
        product_name: nameById.get(aliasPid) ?? it.canonical_name,
        confidence: 1,
      }
    }

    const choice = choiceByIndex.get(i)
    if (
      choice?.product_id &&
      choice.confidence >= MATCH_CONFIDENCE &&
      candidates.some((c) => c.product_id === choice.product_id)
    ) {
      return {
        ...base,
        resolution: 'matched' as const,
        product_id: choice.product_id,
        product_name: nameById.get(choice.product_id) ?? null,
        confidence: choice.confidence,
      }
    }

    if (candidates.length > 0) {
      return {
        ...base,
        resolution: 'ambiguous' as const,
        product_id: null,
        product_name: null,
        confidence: choice?.confidence ?? 0,
      }
    }

    return {
      ...base,
      resolution: 'new' as const,
      product_id: null,
      product_name: null,
      confidence: 0,
    }
  })

  return jsonResponse({ merchant, rows }, 200)
})

// ---------------------------------------------------------------------------
// Anthropic helpers
// ---------------------------------------------------------------------------

const EXTRACT_TOOL = {
  name: 'record_receipt_items',
  description:
    'Record every purchasable product line found on the receipt. Skip ' +
    'non-product lines: subtotal, tax, total, change, tender, savings, ' +
    'loyalty, and store metadata.',
  input_schema: {
    type: 'object',
    properties: {
      merchant: { type: 'string', description: 'Store / merchant name if visible.' },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            raw_text: {
              type: 'string',
              description: 'The line exactly as printed (abbreviations intact).',
            },
            canonical_name: {
              type: 'string',
              description:
                'A clean, expanded product name (e.g. "GV WHL MLK GAL" -> ' +
                '"Whole Milk"). No brand, no size.',
            },
            brand: { type: 'string', description: 'Brand if identifiable.' },
            category: {
              type: 'string',
              description: 'Best-guess category (e.g. Dairy, Produce).',
            },
            quantity: { type: 'number', description: 'Quantity purchased; default 1.' },
            unit: {
              type: 'string',
              enum: KNOWN_UNITS,
              description:
                'Unit if shown, mapped onto one of the listed values. ' +
                'Omit if unclear.',
            },
            unit_price: {
              type: 'number',
              description: 'Per-unit price if derivable from the line.',
            },
          },
          required: ['raw_text', 'canonical_name', 'quantity'],
        },
      },
    },
    required: ['line_items'],
  },
} as const

const RESOLVE_TOOL = {
  name: 'resolve_lines',
  description:
    'For each receipt line, choose the catalog product it refers to from ' +
    'the provided candidates, or none if no candidate is the same product.',
  input_schema: {
    type: 'object',
    properties: {
      resolutions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            product_id: {
              type: 'string',
              description:
                'The chosen candidate product_id, or "" if none of the ' +
                'candidates is the same product.',
            },
            confidence: {
              type: 'number',
              description: '0..1 confidence in the choice.',
            },
          },
          required: ['index', 'product_id', 'confidence'],
        },
      },
    },
    required: ['resolutions'],
  },
} as const

async function extractLineItems(
  imageBase64: string,
  mime: string,
): Promise<{ merchant: string | null; line_items: ExtractedItem[] }> {
  const out = await callClaudeTool(EXTRACT_TOOL, [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mime, data: imageBase64 },
        },
        {
          type: 'text',
          text:
            'Extract the purchasable line items from this receipt. Expand ' +
            'abbreviated names into clean canonical product names. Ignore ' +
            'subtotal, tax, total, and payment lines.',
        },
      ],
    },
  ])
  const merchant = typeof out.merchant === 'string' ? out.merchant : null
  const line_items = Array.isArray(out.line_items)
    ? (out.line_items as ExtractedItem[])
    : []
  return { merchant, line_items }
}

async function disambiguate(
  lines: {
    index: number
    raw_text: string
    canonical_name: string
    candidates: Candidate[]
  }[],
): Promise<{ index: number; product_id: string; confidence: number }[]> {
  const out = await callClaudeTool(RESOLVE_TOOL, [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            'Match each receipt line to the correct catalog product from ' +
            'its candidates, or "" if none match. Lines:\n' +
            JSON.stringify(lines, null, 2),
        },
      ],
    },
  ])
  return Array.isArray(out.resolutions)
    ? (out.resolutions as { index: number; product_id: string; confidence: number }[])
    : []
}

// Calls Claude forcing a single tool use and returns the tool input object.
async function callClaudeTool(
  tool: { name: string },
  messages: unknown[],
): Promise<Record<string, unknown>> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey!,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: receiptModel,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages,
    }),
  })
  if (!res.ok) {
    throw new Error(`Anthropic responded ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: Record<string, unknown> }[]
  }
  const block = data.content?.find(
    (b) => b.type === 'tool_use' && b.name === tool.name,
  )
  if (!block?.input) {
    throw new Error('Claude did not return the expected tool output')
  }
  return block.input
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
