/**
 * app/(app)/layout.tsx
 *
 * Wraps all authenticated routes: /profile, /match, /sessions, /feedback, /subscribe
 *
 * Server Component — verifies auth server-side (belt-and-suspenders on top of
 * middleware) and renders the nav. Each child page fetches its own data.
 *
 * Sign-out uses a Server Action: no separate Client Component file needed,
 * no client-side JS required, no flash.
 *
 * Profile-completion redirect is NOT done here to avoid pathname-detection
 * complexity in layouts. The /match page detects an empty profile and shows
 * a "Complete your profile" prompt instead.
 */

import Link      from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'

// All routes under (app) require a live session cookie — never pre-render.
export const dynamic = 'force-dynamic'

// ── Sign-out Server Action ────────────────────────────────────────────────────

async function signOut() {
  'use server'
  const supabase = createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: '/match',    label: 'Match'    },
  { href: '/sessions', label: 'Sessions' },
  { href: '/profile',  label: 'Profile'  },
]

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side auth check — middleware already guards these routes,
  // but we need the user object to render the nav and for child pages.
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div
      style={{
        minHeight:      '100dvh',
        display:        'flex',
        flexDirection:  'column',
      }}
    >
      {/* ── Nav ── */}
      <header
        style={{
          borderBottom:    '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-background)',
          position:        'sticky',
          top:             0,
          zIndex:          10,
        }}
      >
        <div
          className="session-shell"
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '0.875rem 1.5rem',
          }}
        >
          {/* Wordmark → match page (the app home) */}
          <Link href="/match" className="wordmark">
            Chavruta
          </Link>

          {/* Nav links + sign out */}
          <nav
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '0.25rem',
            }}
          >
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="btn btn-ghost"
                style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.04em' }}
              >
                {label}
              </Link>
            ))}

            <div
              style={{
                width:           '1px',
                height:          '1rem',
                backgroundColor: 'var(--color-border)',
                margin:          '0 0.25rem',
              }}
            />

            {/* Sign-out form — Server Action, no JS required */}
            <form action={signOut}>
              <button
                type="submit"
                className="btn btn-ghost"
                style={{
                  fontSize:      'var(--text-xs)',
                  letterSpacing: '0.04em',
                  color:         'var(--color-muted)',
                }}
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      {/* ── Page content ── */}
      <main
        style={{
          flex:    1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>

    </div>
  )
}
