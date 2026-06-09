type Tone = 'brand' | 'muted' | 'neutral' | 'warn' | 'destructive'

const TONE_CLASSES: Record<Tone, string> = {
  brand:
    'border border-brand/40 bg-brand/15 text-brand',
  muted:
    'border border-border bg-muted text-muted-foreground',
  neutral:
    'border border-border bg-secondary text-foreground',
  warn:
    'border border-amber-500/40 bg-amber-500/15 text-amber-300',
  destructive:
    'border border-destructive/40 bg-destructive/15 text-destructive',
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

export const ASSIGNMENT_STATUS_TONE: Record<
  'active' | 'completed' | 'paused',
  Tone
> = {
  active: 'brand',
  completed: 'muted',
  paused: 'warn',
}
