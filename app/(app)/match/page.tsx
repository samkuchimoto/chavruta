/**
 * app/(app)/match/page.tsx
 *
 * Primary post-login destination. Five states:
 *
 *   no_profile    — profile row doesn't exist → prompt to /profile
 *   active        — live session underway → link to thread
 *   pending       — matched, choosing slots / waiting for partner → link to session
 *   queued        — in queue, waiting for a match
 *   ready         — has profile, subscribed or not, no session → MatchRequest
 *
 * Server Component — all state is determined by DB queries here.
 * Only the match request button is a Client Component (MatchRequest.tsx).
 */

import Link                            from 'next/link'
import { redirect }                    from 'next/navigation'
import type { Metadata }               from 'next'
import { createServerSupabaseClient }  from '@/lib/supabase'
import { MatchRequest }                from './MatchRequest'

export const metadata: Metadata = { title: 'Match' }

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MatchPage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, subscription_status, in_queue, what_i_know, what_i_want')
    .eq('id', user.id)
    .maybeSingle()

  // ── No profile → prompt to complete setup ─────────────────────────────────
  if (!profile || !profile.what_i_know || !profile.what_i_want) {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">
          <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
            Set up your profile first.
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
            Tell us what you know and what you want to think about.
            That's how we find your chavruta.
          </p>
          <Link href="/profile" className="btn btn-primary">
            Complete your profile →
          </Link>
        </div>
      </div>
    )
  }

  // ── Fetch current session (pending or active) ──────────────────────────────
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, scheduled_at,
      accepted_a, accepted_b,
      user_a, user_b,
      source_text_id
    `)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch partner profile if there's a session
  let partnerName = 'your chavruta'
  if (session) {
    const partnerId = session.user_a === user.id ? session.user_b : session.user_a
    const { data: partner } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', partnerId)
      .maybeSingle()
    if (partner?.display_name) partnerName = partner.display_name
  }

  const isSubscribed = profile.subscription_status === 'active'

  // ── Active session ─────────────────────────────────────────────────────────
  if (session?.status === 'active') {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">

          <p className="source-text-title mb-3">Live session</p>
          <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
            Your session with {partnerName} is underway.
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            {session.scheduled_at
              ? `Started at ${new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
              : 'The timer started with the first message.'
            }
          </p>

          <Link href={`/sessions/${session.id}`} className="btn btn-primary">
            Return to session →
          </Link>

        </div>
      </div>
    )
  }

  // ── Pending session ────────────────────────────────────────────────────────
  if (session?.status === 'pending') {
    const iAmA           = session.user_a === user.id
    const iHaveAccepted  = iAmA ? session.accepted_a : session.accepted_b
    const bothAccepted   = session.accepted_a && session.accepted_b

    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">

          <p className="source-text-title mb-3">Matched</p>
          <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
            You've been matched with {partnerName}.
          </h1>

          {bothAccepted && session.scheduled_at ? (
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              Session confirmed for{' '}
              {new Date(session.scheduled_at).toLocaleDateString([], {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}.
            </p>
          ) : iHaveAccepted ? (
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              You've chosen your slot. Waiting for {partnerName} to choose theirs.
            </p>
          ) : (
            <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
              Choose a time for your session. {partnerName} is doing the same.
            </p>
          )}

          <Link href={`/sessions/${session.id}`} className="btn btn-primary">
            {iHaveAccepted ? 'View session →' : 'Choose your slot →'}
          </Link>

        </div>
      </div>
    )
  }

  // ── In queue ───────────────────────────────────────────────────────────────
  if (profile.in_queue) {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">

          <p className="source-text-title mb-3">In queue</p>
          <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
            We're looking for your chavruta.
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)', maxWidth: '440px' }}>
            You'll get an email when we find a complementary match.
            This usually takes a few hours — sometimes longer if the queue is thin.
          </p>

          <div
            className="card"
            style={{ maxWidth: '360px', borderColor: 'var(--color-border-subtle)' }}
          >
            <p
              className="text-sm"
              style={{
                color:      'var(--color-muted)',
                fontStyle:  'italic',
                fontFamily: 'var(--font-serif)',
                fontSize:   '1rem',
                lineHeight: '1.7',
              }}
            >
              The wait is part of it. A match worth having takes longer
              than a match made quickly.
            </p>
          </div>

        </div>
      </div>
    )
  }

  // ── Ready to match ─────────────────────────────────────────────────────────
  return (
    <div className="page-shell pt-fluid">
      <div className="prose-shell animate-fade-in">

        <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
          Ready for your next chavruta?
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
          You're matched on what you know and what you want — not credentials,
          not location, not availability beyond the session itself.
        </p>

        <MatchRequest hasSubscription={isSubscribed} />

      </div>
    </div>
  )
}
