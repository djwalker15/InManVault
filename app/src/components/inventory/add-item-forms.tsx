import { CustomProductForm } from './custom-product-form'
import { InventoryForm } from './inventory-form'
import { RestockForm } from './restock-form'
import type { ProductRow, Selection } from './types'

/**
 * The "what happens after a Product is resolved" phases shared by every
 * add-inventory method. The resolver step differs per method (manual search,
 * barcode camera, …) but once a Product is identified the forms are identical:
 *  - `custom`   — create a crew-private Product, then fall through to `selected`
 *  - `selected` — capture quantity/location/etc. via the full InventoryForm
 *  - `restock`  — add quantity to an existing InventoryItem
 */
export type AddPhase =
  | {
      kind: 'custom'
      initialName?: string
      initialBarcode?: string
      /** "Create similar" seed — see CustomProductForm.initialProduct. */
      initialProduct?: Pick<
        ProductRow,
        | 'name'
        | 'brand'
        | 'variant'
        | 'size_value'
        | 'size_unit'
        | 'default_category_id'
      >
      autoFocusVariant?: boolean
    }
  | { kind: 'selected'; selection: Selection }
  | { kind: 'restock'; selection: Extract<Selection, { kind: 'restock' }> }

interface AddItemFormsProps {
  crewId: string
  userId: string
  phase: AddPhase
  /** A custom Product was created — caller advances to the `selected` phase. */
  onCustomCreated: (product: ProductRow) => void
  /** The item was added/restocked successfully. */
  onSaved: () => void
  /** Back out to the resolver (search field, camera, …). */
  onCancel: () => void
}

export function AddItemForms({
  crewId,
  userId,
  phase,
  onCustomCreated,
  onSaved,
  onCancel,
}: AddItemFormsProps) {
  if (phase.kind === 'custom') {
    return (
      <CustomProductForm
        crewId={crewId}
        userId={userId}
        initialName={phase.initialName}
        initialBarcode={phase.initialBarcode}
        initialProduct={phase.initialProduct}
        autoFocusVariant={phase.autoFocusVariant}
        onCreated={onCustomCreated}
        onCancel={onCancel}
      />
    )
  }

  if (phase.kind === 'selected') {
    return (
      <InventoryForm
        crewId={crewId}
        selection={phase.selection}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    )
  }

  return (
    <RestockForm
      row={phase.selection.item}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
}
