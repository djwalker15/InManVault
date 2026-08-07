export type UnitType =
  | 'premises'
  | 'area'
  | 'zone'
  | 'section'
  | 'sub_section'
  | 'container'
  | 'shelf'

export interface SpaceNode {
  space_id: string
  parent_id: string | null
  unit_type: UnitType
  name: string
  deleted_at?: string | null
  /** crew-media storage path for the space photo (see Media Storage). */
  image_path?: string | null
}

/** The select list matching SpaceNode — keep the two in lockstep. */
export const SPACE_COLUMNS =
  'space_id, parent_id, unit_type, name, deleted_at, image_path'

export const UNIT_TYPE_GLYPH: Record<UnitType, string> = {
  premises: '🏠',
  area: '🏷️',
  zone: '📍',
  section: '📐',
  sub_section: '🔩',
  container: '📦',
  shelf: '📏',
}

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  premises: 'Premises',
  area: 'Area',
  zone: 'Zone',
  section: 'Section',
  sub_section: 'Sub-section',
  container: 'Container',
  shelf: 'Shelf',
}
