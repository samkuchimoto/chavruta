/**
 * app/(app)/feedback/[id]/page.tsx
 *
 * Server Component — guards on session status and prior submission,
 * then renders FeedbackFormClient.
 *
 * Guard order:
 *   1. Session must exist and belong to the user (RLS handles this —
 *      a non-participant gets null back, not a leaked row)
 *   2. Session must be 'completed' — feedback before the session ends
 *      makes no sense, and the feedback RLS insert policy enforces this
 *      too (defense in depth)
 *   3. If feedback already exists for this user+session, show a
 *      confirmation instead of the form (feedback table has a unique
 *      constraint on session_id+user_id, so resubmission would fail anyway —
 *      better to short-circuit with a clear message)
 */

import { notFound, redirect }          from 'next/navigation'
import Link                            from 'next/link'
import type { Metadata }               from 'next'
import { createServerSupabaseClient }  from '@/lib/supabase'
import { FeedbackFormClient }          from './FeedbackFormClient'

export const metadata: Metadata = { title: 'Feedback' }

type Params = { params: { id: string } }

export default async function FeedbackPage({ params }: Params) {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Fetch session (RLS-scoped to participants) ──────────────────────────────
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, user_a, user_b')
    .eq('id', params.id)
    .maybeSingle()

  if (!session) {
    notFound()
  }

  // ── Must be completed ────────────────────────────────────────────────────────
  if (session.status !== 'completed') {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">
          <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
            This session hasn&apos;t ended yet.
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
            Feedback opens once the session is complete.
          </p>
          <Link href={`/sessions/${session.id}`} className="btn btn-primary">
            Return to session →
          </Link>
        </div>
      </div>
    )
  }

  // ── Partner name ─────────────────────────────────────────────────────────────
  const partnerId = session.user_a === user.id ? session.user_b : session.user_a
  const { data: partner } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', partnerId)
    .maybeSingle()
  const partnerName = partner?.display_name ?? 'your chavruta'

  // ── Already submitted? ───────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('feedback')
    .select('id')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return (
      <div className="page-shell pt-fluid">
        <div className="prose-shell animate-fade-in">
          <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
            You've already left feedback for this session.
          </h1>
          <Link href="/match" className="btn btn-primary">
            Find your next chavruta →
          </Link>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell pt-fluid">
      <div className="prose-shell animate-fade-in">

        <p className="source-text-title mb-3">Feedback</p>
        <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
          How did it go?
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
          Takes less than a minute. Your answers shape who you meet next.
        </p>

        <FeedbackFormClient sessionId={session.id} partnerName={partnerName} />

      </div>
    </div>
  )
}
