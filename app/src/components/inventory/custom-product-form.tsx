import { useEffect, useId, useState, type FormEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { CtaTray, Field, PrimaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { deleteCrewImage, uploadCrewImage } from '@/lib/media'
import { PRODUCT_COLUMNS, type ProductRow } from './types'
import { useCrewBrands, useCrewVariants } from './use-crew-brands'

interface CustomProductFormProps {
  crewId: string
  userId: string
  /** Pre-fill the name when invoked from a no-match search. */
  initialName?: string
  /** Pre-fill the barcode when invoked from a no-match barcode scan. */
  initialBarcode?: string
  /** Pre-fill the variant descriptor. */
  initialVariant?: string
  /**
   * "Create similar": seed the draft from an existing product. Barcode is
   * deliberately never copied — UPCs are unique per variant, and a copied
   * one would produce false barcode-scan hits.
   */
  initialProduct?: Pick<
    ProductRow,
    'name' | 'brand' | 'variant' | 'size_value' | 'size_unit' | 'default_category_id'
  >
  /**
   * Focus the variant field instead of name — for "create similar", where
   * the variant is usually the one field that differs.
   */
  autoFocusVariant?: boolean
  onCreated: (product: ProductRow) => void
  onCancel: () => void
}

interface CategoryRow {
  category_id: string
  name: string
  crew_id: string | null
}

interface UnitRow {
  unit: string
  unit_category: string
}

export function CustomProductForm({
  crewId,
  userId,
  initialName = '',
  initialBarcode = '',
  initialVariant = '',
  initialProduct,
  autoFocusVariant = false,
  onCreated,
  onCancel,
}: CustomProductFormProps) {
  const supabase = useSupabase()
  const [name, setName] = useState(initialProduct?.name ?? initialName)
  const [brand, setBrand] = useState(initialProduct?.brand ?? '')
  const [variant, setVariant] = useState(
    initialProduct?.variant ?? initialVariant,
  )
  const [barcode, setBarcode] = useState(initialBarcode)
  const [sizeValue, setSizeValue] = useState(
    initialProduct?.size_value != null ? String(initialProduct.size_value) : '',
  )
  const [sizeUnit, setSizeUnit] = useState<string>(
    initialProduct?.size_unit ?? '',
  )
  const [categoryId, setCategoryId] = useState<string>(
    initialProduct?.default_category_id ?? '',
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { brands, canonicalize } = useCrewBrands()
  const { variants, canonicalize: canonicalizeVariant } = useCrewVariants()
  const brandListId = useId()
  const variantListId = useId()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: catData }, { data: unitData }] = await Promise.all([
        supabase
          .from('categories')
          .select('category_id, name, crew_id')
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('unit_definitions')
          .select('unit, unit_category')
          .order('unit', { ascending: true }),
      ])
      if (cancelled) return
      setCategories(Array.isArray(catData) ? (catData as CategoryRow[]) : [])
      setUnits(Array.isArray(unitData) ? (unitData as UnitRow[]) : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const trimmedName = name.trim()
  const valid = trimmedName.length >= 1 && trimmedName.length <= 200
  const sizeValueNumeric = sizeValue.trim() === '' ? null : Number(sizeValue)
  const sizeInvalid =
    sizeValue.trim() !== '' &&
    (Number.isNaN(sizeValueNumeric) || (sizeValueNumeric ?? 0) < 0)
  const sizePartial =
    (sizeValueNumeric !== null && !sizeUnit) ||
    (sizeValueNumeric === null && sizeUnit)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (sizeInvalid) {
      setError('Size must be a non-negative number.')
      return
    }
    if (sizePartial) {
      setError('Provide both a size value and a unit, or neither.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert({
          crew_id: crewId,
          name: trimmedName,
          brand: brand.trim() || null,
          variant: variant.trim() || null,
          barcode: barcode.trim() || null,
          size_value: sizeValueNumeric,
          size_unit: sizeUnit || null,
          default_category_id: categoryId || null,
          source: 'crew_created',
          created_by: userId,
        })
        .select(PRODUCT_COLUMNS)
        .single()
      if (insertError) throw insertError
      if (!data) throw new Error('Product insert returned no row')
      let created = data as ProductRow
      if (imageFile) {
        // Image failure never rolls back the product — the letter
        // fallback renders and the photo can be added from Edit.
        try {
          const path = await uploadCrewImage(
            supabase,
            crewId,
            'products',
            imageFile,
            created.product_id,
          )
          const { error: imageError } = await supabase
            .from('products')
            .update({ image_url: path })
            .eq('product_id', created.product_id)
          if (imageError) {
            void deleteCrewImage(supabase, path)
            throw imageError
          }
          created = { ...created, image_url: path }
        } catch (imageErr) {
          console.warn('Product image upload failed', imageErr)
        }
      }
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-xl font-bold text-ink-900">
          Create a custom product
        </h2>
        <p className="mt-1 font-body text-sm text-ink-700">
          Crew-private. The InMan team can promote it to the master catalog
          later if it's broadly useful.
        </p>
      </header>

      <Field
        label="PRODUCT NAME"
        placeholder="Heinz tomato paste"
        value={name}
        onValueChange={setName}
        autoFocus={!autoFocusVariant}
        required
        minLength={1}
        maxLength={200}
      />
      <Field
        label="BRAND (OPTIONAL)"
        placeholder="Heinz"
        value={brand}
        onValueChange={setBrand}
        maxLength={120}
        list={brandListId}
        // Typing a brand that already exists in a different case would
        // fragment search, so settle on the spelling already in the catalog.
        onBlur={() => setBrand((b) => canonicalize(b))}
      />
      <datalist id={brandListId}>
        {brands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <Field
        label="VARIANT (OPTIONAL)"
        placeholder="Cherry Zero Sugar — flavor first"
        hint="Flavor, scent, or style. Size has its own fields below."
        value={variant}
        onValueChange={setVariant}
        autoFocus={autoFocusVariant}
        maxLength={80}
        list={variantListId}
        // Same consistency nudge as brand: settle on the spelling already in
        // the catalog so "lime" and "Lime" don't fragment search.
        onBlur={() => setVariant((v) => canonicalizeVariant(v))}
      />
      <datalist id={variantListId}>
        {variants.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <Field
        label="BARCODE (OPTIONAL)"
        placeholder="UPC / EAN"
        value={barcode}
        onValueChange={setBarcode}
        inputMode="numeric"
        maxLength={32}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Pack size (optional)
        </legend>
        <div className="flex gap-2">
          <input
            aria-label="Size value"
            type="number"
            min="0"
            step="0.01"
            value={sizeValue}
            onChange={(e) => setSizeValue(e.target.value)}
            placeholder="6"
            className="h-14 w-24 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
          />
          <select
            aria-label="Size unit"
            value={sizeUnit}
            onChange={(e) => setSizeUnit(e.target.value)}
            className="h-14 flex-1 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
          >
            <option value="">Pick a unit</option>
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.unit} ({u.unit_category})
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Default category (optional)
        </span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-14 rounded-xl bg-paper-100 px-3 font-body text-base text-ink-900 outline-none focus:bg-paper-250"
        >
          <option value="">No default</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name} {c.crew_id === null ? '(system)' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold uppercase tracking-[0.35px] text-ink-900">
          Photo <span className="font-body lowercase text-ink-500">(optional)</span>
        </span>
        {imageFile ? (
          <div className="flex items-center justify-between rounded-xl bg-paper-100 px-4 py-3">
            <span className="truncate font-body text-sm text-ink-700">
              {imageFile.name}
            </span>
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setImageFile(null)}
              className="ml-3 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-600 transition hover:bg-paper-200"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-paper-100 px-4 py-3 font-body text-sm text-ink-600 transition hover:bg-paper-200">
            <ImagePlus size={16} aria-hidden />
            Add a photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <CtaTray sticky={false}>
        <PrimaryButton arrow type="submit" disabled={submitting || !valid}>
          {submitting ? 'Creating…' : 'Create product'}
        </PrimaryButton>
        <TextButton type="button" onClick={onCancel}>
          Back to search
        </TextButton>
      </CtaTray>
    </form>
  )
}
