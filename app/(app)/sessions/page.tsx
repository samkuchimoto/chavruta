/**
 * app/(app)/sessions/page.tsx
 *
 * Full session history for the current user — free to view regardless of
 * subscription status (per build prompt: "Browsing your own profile and
 * completed session history does not [require a subscription]").
 *
 * Server Component. One query for sessions, one batched query for all
 * partner profiles (avoids N+1), client-side grouping into
 * current (pending/active) vs past (completed/no-show).
 */

import Link                            from 'next/link'
import { redirect }                    from 'next/navigation'
import type { Metadata }               from 'next'
import { createServerSupabaseClient }  from '@/lib/supabase'
import type { Session }                from '@/lib/supabase'

export const metadata: Metadata = { title: 'Sessions' }

// ── Status badge ──────────────────────────────────────────────────────────────

function statusBadge(status: Session['status']) {
  const map: Record<Session['status'], { label: string; cls: string }> = {
    pending:   { label: 'Choosing time', cls: 'badge-pending' },
    active:    { label: 'Live',          cls: 'badge-active'  },
    completed: { label: 'Completed',     cls: 'badge-done'    },
    'no-show': { label: 'No-show',       cls: 'badge-error'   },
  }
  const { label, cls } = map[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Row ───────────────────────────────────────────────────────────────────────

function SessionRow({
  session,
  partnerName,
}: {
  session:     Session
  partnerName: string
}) {
  const dateLabel = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : new Date(session.created_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      })

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="card"
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            '1rem',
        marginBottom:   '0.625rem',
      }}
    >
      <div>
        <p className="text-sm mb-1" style={{ color: 'var(--color-foreground)' }}>
          {partnerName}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {dateLabel}
        </p>
      </div>
      {statusBadge(session.status)}
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SessionsPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const list = sessions ?? []

  // ── Batch-fetch partner profiles (avoid N+1 queries) ────────────────────────
  const partnerIds = Array.from(new Set(
    list.map(s => (s.user_a === user.id ? s.user_b : s.user_a))
  ))

  const { data: partners } = partnerIds.length
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', partnerIds)
    : { data: [] }

  const nameById = new Map((partners ?? []).map(p => [p.id, p.display_name]))

  function partnerNameFor(session: Session): string {
    const partnerId = session.user_a === user!.id ? session.user_b : session.user_a
    return nameById.get(partnerId) ?? 'Unknown'
  }

  const current = list.filter(s => s.status === 'pending' || s.status === 'active')
  const past    = list.filter(s => s.status === 'completed' || s.status === 'no-show')

  return (
    <div className="page-shell pt-fluid">
      <div className="prose-shell animate-fade-in">

        <div className="mb-10" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="text-2xl" style={{ letterSpacing: '-0.01em' }}>
            Sessions
          </h1>
          <Link href="/match" className="btn btn-outline" style={{ fontSize: 'var(--text-xs)' }}>
            New match →
          </Link>
        </div>

        {/* ── Empty state ── */}
        {list.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
              No sessions yet.
            </p>
            <Link href="/match" className="btn btn-primary">
              Request your first match →
            </Link>
          </div>
        )}

        {/* ── Current ── */}
        {current.length > 0 && (
          <div className="mb-10">
            <p className="label mb-4">Current</p>
            {current.map(s => (
              <SessionRow key={s.id} session={s} partnerName={partnerNameFor(s)} />
            ))}
          </div>
        )}

        {/* ── Past ── */}
        {past.length > 0 && (
          <div>
            <p className="label mb-4">Past</p>
            {past.map(s => (
              <SessionRow key={s.id} session={s} partnerName={partnerNameFor(s)} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
