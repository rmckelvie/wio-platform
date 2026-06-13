import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExerciseForm } from '@/components/exercise-form'
import { buttonVariants } from '@/components/ui/button'
import { updateExercise } from '../../actions'
import type { SectionType } from '@/lib/sections'

export default async function EditExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: errMsg } = await searchParams

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, video_url, default_notes, section_types, subcategory')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const updateThis = updateExercise.bind(null, data.id)
  const sectionTypes = (data.section_types ?? []) as SectionType[]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/exercises"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ← Exercises
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Edit exercise</h1>
      <ExerciseForm
        action={updateThis}
        initial={{
          name: data.name,
          video_url: data.video_url,
          default_notes: data.default_notes,
          section_types: sectionTypes,
          subcategory: data.subcategory,
        }}
        submitLabel="Save changes"
        error={errMsg}
      />
    </div>
  )
}
