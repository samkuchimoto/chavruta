/**
 * app/(app)/subscribe/page.tsx
 *
 * Subscription page — shown when a user tries to request a match
 * without an active subscription.
 *
 * Handles two scenarios cleanly:
 *   config.stripe = true  → shows the real payment button
 *   config.stripe = false → shows "payments not yet active" message
 *
 * This avoids any 503/error state being visible to users in demo mode.
 */

'use client'

import { useState }           from 'react'
import Link                   from 'next/link'

export default function SubscribePage() {
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }

      if (res.status === 503 || data.error === 'payments_not_configured') {
        setError('Payments are not yet active on this instance. Check back soon.')
        setLoading(false)
        return
      }

      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start checkout. Try again.')
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('Network error. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="page-shell pt-fluid">
      <div className="narrow-shell animate-fade-in">

        <div className="mb-10">
          <Link href="/match" className="wordmark">Chavruta</Link>
        </div>

        <h1 className="text-2xl mb-3" style={{ letterSpacing: '-0.01em' }}>
          Subscribe to keep matching.
        </h1>

        <p className="text-sm mb-8" style={{ color: 'var(--color-muted)' }}>
          Your profile and session history are always free.
          Requesting new matches requires an active subscription.
        </p>

        <div className="card mb-8" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="text-3xl" style={{ color: 'var(--color-foreground)', letterSpacing: '-0.02em' }}>
              €15
            </span>
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>/month</span>
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {[
              'Unlimited match requests',
              'Timed 45-minute sessions',
              'Feedback-driven matching',
              'Cancel any time',
            ].map(item => (
              <li key={item} className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="mb-5 text-sm" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'Preparing checkout…' : 'Subscribe — €15/month'}
        </button>

        <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-muted)' }}>
          Secure checkout via Stripe. Cancel any time from your profile.
        </p>

      </div>
    </div>
  )
}
