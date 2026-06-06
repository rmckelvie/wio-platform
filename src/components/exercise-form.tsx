import { Button } from '@/components/ui/button'

interface ExerciseFormProps {
  action: (formData: FormData) => void | Promise<void>
  initial?: {
    name?: string
    video_url?: string | null
    default_notes?: string | null
  }
  submitLabel: string
  error?: string
}

export function ExerciseForm({
  action,
  initial,
  submitLabel,
  error,
}: ExerciseFormProps) {
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
          className="rounded border px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Video URL</span>
        <input
          name="video_url"
          type="url"
          defaultValue={initial?.video_url ?? ''}
          placeholder="https://youtube.com/..."
          className="rounded border px-3 py-2"
        />
        <span className="text-xs text-gray-500">Optional — demo link clients can open.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Default notes</span>
        <textarea
          name="default_notes"
          rows={3}
          defaultValue={initial?.default_notes ?? ''}
          placeholder="Cues, tempo, common mistakes..."
          className="rounded border px-3 py-2"
        />
        <span className="text-xs text-gray-500">
          Shown to clients alongside this exercise. Can be overridden per row.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}
