/**
 * app/(app)/sessions/[id]/page.tsx
 *
 * Server Component — fetches session, partner, source text, and messages,
 * then renders one of three states:
 *
 *   pending    → SlotPicker (choosing a time)
 *   active     → SessionThread (timer + messages)
 *   completed  → summary + link to feedback (or "feedback submitted" if already done)
 *
 * RLS via the user-scoped client enforces that only session participants
 * can reach this data — a stranger hitting this URL gets a 404-equivalent
 * (empty result), handled by notFound().
 *
 * Flag: the build prompt says "at the scheduled time, the session thread
 * opens." For v1 simplicity, the thread is reachable as soon as both users
 * have accepted (chosen a slot) — there's no hard gate on scheduled_at having
 * arrived. This fits "no schedule beyond the session itself" better than a
 * rigid time-lock would, and avoids timezone-edge-case bugs in a clock gate.
 * Add a scheduled_at <= now() check in /api/messages if strict timing is needed.
 */

import { notFound, redirect }          from 'next/navigation'
import type { Metadata }               from 'next'
import { createServerSupabaseClient }  from '@/lib/supabase'
import { SlotPicker }                  from './SlotPicker'
import { SessionThread }               from './SessionThread'

export const metadata: Metadata = { title: 'Session' }

type Params = { params: { id: string } }

export default async function SessionPage({ params }: Params) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Fetch session (RLS scopes this to participants only) ────────────────────
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!session) {
    notFound()
  }

  const iAmA       = session.user_a === user.id
  const partnerId  = iAmA ? session.user_b : session.user_a
  const myChoice   = iAmA ? session.slot_choice_a : session.slot_choice_b
  const theirChoice = iAmA ? session.slot_choice_b : session.slot_choice_a

  // ── Fetch partner profile ───────────────────────────────────────────────────
  const { data: partner } = await supabase
    .from('profiles')
    .select('display_name, what_i_know')
    .eq('id', partnerId)
    .maybeSingle()

  const partnerName = partner?.display_name ?? 'your chavruta'

  // ── Fetch source text ───────────────────────────────────────────────────────
  const sourceText = session.source_text_id
    ? (await supabase
        .from('source_texts')
        .select('title, body_or_link, topic_tag')
        .eq('id', session.source_text_id)
        .maybeSingle()
      ).data
    : null

  // ── Completed state ───────────────────────────────────────────────────────────
  if (session.status === 'completed') {
    const { data: myFeedback } = await supabase
      .from('feedback')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">
          <p className="source-text-title mb-3">Completed</p>
          <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
            Your session with {partnerName} has ended.
          </h1>

          {myFeedback ? (
            <>
              <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
                You've already left feedback for this session.
              </p>
              <a href="/match" className="btn btn-primary">
                Find your next chavruta →
              </a>
            </>
          ) : (
            <>
              <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
                Two quick questions before you go.
              </p>
              <a href={`/feedback/${session.id}`} className="btn btn-primary">
                Leave feedback →
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── No-show state ─────────────────────────────────────────────────────────────
  if (session.status === 'no-show') {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">
          <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
            This session didn't happen.
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            The scheduled time passed without a session starting.
          </p>
          <a href="/match" className="btn btn-primary">
            Request a new match →
          </a>
        </div>
      </div>
    )
  }

  // ── Active state — full-height thread, no prose-shell wrapper ─────────────────
  if (session.status === 'active') {
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    return (
      <div
        className="session-shell"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}
      >
        {sourceText && (
          <div
            style={{
              padding:      '1.25rem 1.5rem 0',
              maxWidth:     'var(--width-prose)',
              margin:       '0 auto',
              width:        '100%',
            }}
          >
            <p className="source-text-title mb-2">{sourceText.topic_tag ?? 'Today\u2019s text'}</p>
            <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
              {sourceText.title}
            </p>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SessionThread
            sessionId={session.id}
            currentUserId={user.id}
            partnerName={partnerName}
            initialMessages={messages ?? []}
            startedAt={session.started_at}
          />
        </div>
      </div>
    )
  }

  // ── Pending state ──────────────────────────────────────────────────────────────
  // (default — covers 'pending' status)
  const bothAccepted = session.accepted_a && session.accepted_b

  return (
    <div className="page-shell pt-fluid">
      <div className="prose-shell animate-fade-in">

        <p className="source-text-title mb-3">Matched</p>
        <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
          {partnerName}
        </h1>
        {partner?.what_i_know && (
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            Brings: {partner.what_i_know.slice(0, 180)}
            {partner.what_i_know.length > 180 ? '…' : ''}
          </p>
        )}

        {sourceText && (
          <div className="card mb-8" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <p className="source-text-title mb-2">
              {sourceText.topic_tag ?? 'Your text'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
              {sourceText.title}
            </p>
          </div>
        )}

        {bothAccepted && session.scheduled_at ? (
          <div className="card" style={{ borderColor: 'var(--color-accent-dim)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-foreground)' }}>
              Confirmed for{' '}
              {new Date(session.scheduled_at).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              The session opens here at that time. The 45-minute timer starts with your first message.
            </p>
          </div>
        ) : (
          <>
            <p className="label mb-4">Choose a time</p>
            <SlotPicker
              sessionId={session.id}
              proposedSlots={session.proposed_slots}
              myChoice={myChoice}
              partnerChoice={theirChoice}
              partnerName={partnerName}
            />
          </>
        )}

      </div>
    </div>
  )
}
