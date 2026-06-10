import { Button } from '@/components/ui/button'
import {
  SECTION_TYPES,
  sectionLabel,
  type SectionType,
} from '@/lib/sections'

interface ExerciseFormProps {
  action: (formData: FormData) => void | Promise<void>
  initial?: {
    name?: string
    video_url?: string | null
    default_notes?: string | null
    section_types?: SectionType[] | null
    subcategory?: string | null
  }
  submitLabel: string
  error?: string
}

const STRENGTH_SUBCATEGORIES = [
  { value: '', label: '— None —' },
  { value: 'chest', label: 'Chest' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'back', label: 'Back' },
] as const

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export function ExerciseForm({
  action,
  initial,
  submitLabel,
  error,
}: ExerciseFormProps) {
  const currentTags = new Set(initial?.section_types ?? [])

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={initial?.name ?? ''}
          placeholder="e.g. Trap bar deadlift"
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Categories</legend>
        <p className="text-xs text-muted-foreground">
          Which section types this exercise can be prescribed in. Leave them
          all unchecked to make it available in every section.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SECTION_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded border border-border bg-card px-2 py-1.5 text-sm hover:border-brand/60"
            >
              <input
                type="checkbox"
                name="section_types"
                value={t}
                defaultChecked={currentTags.has(t)}
                className="accent-brand"
              />
              {sectionLabel(t)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Strength subcategory</span>
        <select
          name="subcategory"
          defaultValue={initial?.subcategory ?? ''}
          className={inputClass}
        >
          {STRENGTH_SUBCATEGORIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Only used when Strength is checked above — groups the exercise under
          Chest / Shoulders / Arms / Legs / Back in the picker.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Video URL</span>
        <input
          name="video_url"
          type="url"
          defaultValue={initial?.video_url ?? ''}
          placeholder="https://youtube.com/..."
          className={inputClass}
        />
        <span className="text-xs text-muted-foreground">
          Optional — demo link clients can open.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Default notes</span>
        <textarea
          name="default_notes"
          rows={3}
          defaultValue={initial?.default_notes ?? ''}
          placeholder="Cues, tempo, common mistakes..."
          className={inputClass}
        />
        <span className="text-xs text-muted-foreground">
          Shown to clients alongside this exercise. Can be overridden per row.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}
