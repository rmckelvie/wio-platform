import Link from 'next/link'
import { ExerciseForm } from '@/components/exercise-form'
import { createExercise } from '../actions'

export default async function NewExercisePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/admin/exercises"
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Exercises
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">New exercise</h1>
      <ExerciseForm action={createExercise} submitLabel="Create" error={error} />
    </div>
  )
}
