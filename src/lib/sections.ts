export const SECTION_TYPES = [
  'prime',
  'plyo',
  'strength',
  'accessories',
  'conditioning',
  'core_conditioning',
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

export const SECTION_LABELS: Record<SectionType, string> = {
  prime: 'Prime',
  plyo: 'Plyo',
  strength: 'Strength',
  accessories: 'Accessories',
  conditioning: 'Conditioning',
  core_conditioning: 'Core Conditioning',
}

export function sectionLabel(t: SectionType): string {
  return SECTION_LABELS[t] ?? t
}

export function isSectionType(v: string): v is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(v)
}
