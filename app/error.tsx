'use client'

/**
 * app/error.tsx
 *
 * Global error boundary — Next.js App Router requires this to be a
 * Client Component (hence 'use client'). Catches runtime errors that
 * escape individual page try/catch blocks.
 *
 * Two actions available:
 *   retry  — calls reset(), which re-renders the failed segment
 *   home   — navigates to / (always safe, no auth or data dependency)
 *
 * Does not log to an external service in v1 — Vercel's built-in
 * function logs capture the error stack automatically.
 */

import { useEffect } from 'react'
import Link          from 'next/link'

type Props = {
  error:  Error & { digest?: string }
  reset:  () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Vercel captures this in function logs automatically.
    // Add a logging service (Sentry, etc.) here when ready.
    console.error('[error boundary]', error)
  }, [error])

  return (
    <div className="page-shell pt-fluid">
      <div className="narrow-shell animate-fade-in" style={{ textAlign: 'center' }}>

        <p
          style={{
            fontFamily:   'var(--font-serif)',
            fontSize:     '4rem',
            lineHeight:   1,
            color:        'var(--color-muted)',
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          500
        </p>

        <h1 className="text-xl mb-3" style={{ letterSpacing: '-0.01em' }}>
          Something went wrong.
        </h1>

        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
          {error.digest
            ? `Error ref: ${error.digest}`
            : 'An unexpected error occurred.'}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>

      </div>
    </div>
  )
}
