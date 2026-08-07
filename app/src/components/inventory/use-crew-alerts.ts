import { useEffect, useState } from 'react'
import { useSupabase } from '@/lib/supabase'
import {
  alertScore,
  deriveAlerts,
  type InventoryAlert,
} from './inventory-status'

interface RawItem {
  inventory_item_id: string
  product_id: string
  current_space_id: string
  home_space_id: string | null
  quantity: number
  unit: string
  category_id: string | null
  min_stock: number | null
  expiry_date: string | null
}

interface RawProduct {
  product_id: string
  name: string
  brand: string | null
  image_url: string | null
}

interface RawSpace {
  space_id: string
  parent_id: string | null
  name: string
}

export interface AlertRow {
  inventoryItemId: string
  productName: string
  productBrand: string | null
  productImageUrl: string | null
  quantity: number
  unit: string
  locationPath: string
  expiryDate: string | null
  alerts: InventoryAlert[]
  score: number
}

export interface CrewAlerts {
  loading: boolean
  error: string | null
  rows: AlertRow[]
  /** Counts by alert type — an item with N alerts contributes to all N. */
  counts: Record<InventoryAlert, number>
}

const EMPTY_COUNTS: Record<InventoryAlert, number> = {
  out_of_stock: 0,
  low_stock: 0,
  expiring_soon: 0,
  expired: 0,
  displaced: 0,
}

function buildLocationPath(
  spaceId: string,
  spaces: Map<string, RawSpace>,
): string {
  const parts: string[] = []
  let cursor = spaces.get(spaceId)
  let depth = 0
  while (cursor && depth < 10) {
    parts.unshift(cursor.name)
    cursor = cursor.parent_id ? spaces.get(cursor.parent_id) : undefined
    depth++
  }
  return parts.join(' › ')
}

const EMPTY_STATE: CrewAlerts = {
  loading: false,
  error: null,
  rows: [],
  counts: EMPTY_COUNTS,
}

export function useCrewAlerts(crewId: string | null): CrewAlerts {
  const supabase = useSupabase()
  const [state, setState] = useState<CrewAlerts>(() =>
    crewId ? { ...EMPTY_STATE, loading: true } : EMPTY_STATE,
  )

  useEffect(() => {
    if (!crewId) return
    let cancelled = false
    async function load() {
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select(
          'inventory_item_id, product_id, current_space_id, home_space_id, quantity, unit, category_id, min_stock, expiry_date',
        )
        .eq('crew_id', crewId)
        .is('deleted_at', null)
      if (cancelled) return
      if (itemErr) {
        setState({
          loading: false,
          error: itemErr.message ?? 'Failed to load alerts.',
          rows: [],
          counts: EMPTY_COUNTS,
        })
        return
      }
      const items = (Array.isArray(itemData) ? itemData : []) as RawItem[]
      if (items.length === 0) {
        setState({
          loading: false,
          error: null,
          rows: [],
          counts: EMPTY_COUNTS,
        })
        return
      }
      const productIds = Array.from(new Set(items.map((i) => i.product_id)))
      const [productsRes, spacesRes] = await Promise.all([
        supabase
          .from('products')
          .select('product_id, name, brand, image_url')
          .in('product_id', productIds)
          .is('deleted_at', null),
        supabase
          .from('spaces')
          .select('space_id, parent_id, name')
          .eq('crew_id', crewId)
          .is('deleted_at', null),
      ])
      if (cancelled) return

      const products = new Map<string, RawProduct>()
      for (const p of (Array.isArray(productsRes.data)
        ? productsRes.data
        : []) as RawProduct[]) {
        products.set(p.product_id, p)
      }
      const spaces = new Map<string, RawSpace>()
      for (const s of (Array.isArray(spacesRes.data)
        ? spacesRes.data
        : []) as RawSpace[]) {
        spaces.set(s.space_id, s)
      }

      const today = new Date().toISOString().slice(0, 10)
      const counts: Record<InventoryAlert, number> = { ...EMPTY_COUNTS }
      const rows: AlertRow[] = []

      for (const item of items) {
        const alerts = deriveAlerts({
          quantity: item.quantity,
          min_stock: item.min_stock,
          expiry_date: item.expiry_date,
          current_space_id: item.current_space_id,
          home_space_id: item.home_space_id,
          today,
        })
        if (alerts.length === 0) continue
        for (const a of alerts) counts[a] += 1
        const product = products.get(item.product_id)
        rows.push({
          inventoryItemId: item.inventory_item_id,
          productName: product?.name ?? 'Unknown product',
          productBrand: product?.brand ?? null,
          productImageUrl: product?.image_url ?? null,
          quantity: item.quantity,
          unit: item.unit,
          locationPath: buildLocationPath(item.current_space_id, spaces),
          expiryDate: item.expiry_date,
          alerts,
          score: alertScore(alerts),
        })
      }

      rows.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.productName.localeCompare(b.productName)
      })

      setState({ loading: false, error: null, rows, counts })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, crewId])

  return state
}
