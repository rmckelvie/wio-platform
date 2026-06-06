import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <WioLogo variant="wordmark" size={320} priority />

      <div className="space-y-3">
        <p className="text-lg text-muted-foreground">
          Personal training, programmed for you.
        </p>
        <div className="mx-auto h-px w-24 bg-brand" />
      </div>

      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
          Get started
        </Link>
        <Link
          href="/login"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Log in
        </Link>
      </div>
    </main>
  )
}
