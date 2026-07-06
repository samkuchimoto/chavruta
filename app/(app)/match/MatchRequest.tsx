/**
 * app/(app)/match/MatchRequest.tsx
 *
 * Client Component — the one interactive element on the match page.
 * Calls POST /api/match, then:
 *   matched      → router.push to the session
 *   has_session  → router.push to the existing session
 *   queued       → router.refresh() so the Server Component re-fetches
 *                  and renders the queued state
 *   402          → subscription required (shouldn't reach here if
 *                  the page passes hasSubscription correctly, but handled)
 *   error        → inline error with retry
 */

'use client'

import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import Link             from 'next/link'

type Props = {
  hasSubscription: boolean
}

export function MatchRequest({ hasSubscription }: Props) {
  const router  = useRouter()
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)

  // ── Subscription gate ──────────────────────────────────────────────────────
  if (!hasSubscription) {
    return (
      <div>
        <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
          Requesting a match requires an active subscription.
        </p>
        <Link href="/subscribe" className="btn btn-primary">
          Subscribe — €15/month
        </Link>
        <p className="text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
          Your profile and session history are always free to access.
          Matching requires a subscription.
        </p>
      </div>
    )
  }

  // ── Request handler ────────────────────────────────────────────────────────
  async function handleRequest() {
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/match', { method: 'POST' })
      const data = await res.json() as {
        status?:    'queued' | 'matched' | 'has_session'
        sessionId?: string
        error?:     string
      }

      if (res.status === 402) {
        // Subscription lapsed between page load and click (e.g. webhook delay)
        router.push('/subscribe')
        return
      }

      if (res.status === 400 && data.error === 'profile_incomplete') {
        router.push('/profile')
        return
      }

      if (!res.ok) {
        setError('Something went wrong. Try again.')
        setLoading(false)
        return
      }

      if (data.status === 'matched' || data.status === 'has_session') {
        router.push(`/sessions/${data.sessionId}`)
        return
      }

      if (data.status === 'queued') {
        // Refresh the Server Component — it will re-fetch and show the queued state
        router.refresh()
        return
      }

    } catch {
      setError('Network error. Check your connection and try again.')
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <button
        onClick={handleRequest}
        disabled={loading}
        className="btn btn-primary"
        style={{ minWidth: '180px' }}
      >
        {loading ? 'Looking for your chavruta…' : 'Request a match'}
      </button>

      {error && (
        <p
          className="text-sm mt-3"
          style={{ color: 'var(--color-destructive)' }}
        >
          {error}
        </p>
      )}

      {!loading && !error && (
        <p className="text-xs mt-4" style={{ color: 'var(--color-muted)', maxWidth: '400px' }}>
          A match is immediate if someone in the queue is complementary to you,
          or may take a few hours if the queue is thin.
          You'll get an email either way.
        </p>
      )}
    </div>
  )
}
