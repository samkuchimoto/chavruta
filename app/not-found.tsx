/**
 * app/not-found.tsx
 *
 * Rendered when notFound() is called from any Server Component or when
 * no route matches the URL. No data fetching, no auth check — this page
 * must always render regardless of Supabase state.
 */

import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Not found' }

export default function NotFound() {
  return (
    <div className="page-shell pt-fluid">
      <div className="narrow-shell animate-fade-in" style={{ textAlign: 'center' }}>

        <p
          style={{
            fontFamily:    'var(--font-serif)',
            fontSize:      '4rem',
            lineHeight:    1,
            color:         'var(--color-muted)',
            marginBottom:  '1.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          404
        </p>

        <h1 className="text-xl mb-3" style={{ letterSpacing: '-0.01em' }}>
          Nothing here.
        </h1>

        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
          This page doesn't exist or you don't have access to it.
        </p>

        <Link href="/" className="btn btn-outline">
          Back to home
        </Link>

      </div>
    </div>
  )
}
