/**
 * Render a product's pack size ("12 fl_oz") when both halves are set.
 * The null checks are deliberate: `size_value` can legitimately be 0, so
 * truthiness tests would silently drop it.
 */
export function formatSize(
  sizeValue: number | null,
  sizeUnit: string | null,
): string | null {
  // == null also catches undefined from partial rows in tests/legacy data.
  if (sizeValue == null || sizeUnit == null) return null
  return `${sizeValue} ${sizeUnit}`
}
