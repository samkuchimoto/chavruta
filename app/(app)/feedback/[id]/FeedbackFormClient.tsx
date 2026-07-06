/**
 * app/(app)/feedback/[id]/FeedbackFormClient.tsx
 *
 * Client Component — star rating + free text, posts to /api/feedback.
 * On success, redirects to /match (which shows the paywall, queue, or
 * ready state depending on subscription — the natural next step per
 * the build prompt's "Subscriber can request another match" flow).
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  sessionId:   string
  partnerName: string
}

const RATING_LABELS: Record<number, string> = {
  1: 'Not for me',
  2: 'Below expectations',
  3: 'Fine',
  4: 'Good',
  5: 'Exceptional',
}

export function FeedbackFormClient({ sessionId, partnerName }: Props) {
  const router = useRouter()

  const [rating,      setRating]      = useState<number | null>(null)
  const [hoverRating,  setHoverRating] = useState<number | null>(null)
  const [whatEmerged,  setWhatEmerged] = useState('')
  const [submitting,   setSubmitting]  = useState(false)
  const [error,        setError]       = useState<string | null>(null)

  const displayRating = hoverRating ?? rating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) {
      setError('Choose a rating before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:   sessionId,
          rating,
          what_emerged: whatEmerged.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Could not submit feedback. Try again.')
        setSubmitting(false)
        return
      }

      router.push('/match')
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Rating ── */}
      <div className="mb-8">
        <label className="label mb-3" style={{ display: 'block' }}>
          How was the session with {partnerName}?
        </label>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(null)}
              disabled={submitting}
              aria-label={`Rate ${n} out of 5`}
              style={{
                width:           '3rem',
                height:          '3rem',
                borderRadius:    'var(--radius)',
                border:          '1px solid',
                borderColor:     displayRating && n <= displayRating
                                    ? 'var(--color-accent)'
                                    : 'var(--color-border)',
                backgroundColor: displayRating && n <= displayRating
                                    ? 'var(--color-accent-glow)'
                                    : 'var(--color-surface)',
                color:           displayRating && n <= displayRating
                                    ? 'var(--color-accent)'
                                    : 'var(--color-muted)',
                fontFamily:      'var(--font-serif)',
                fontSize:        '1.125rem',
                cursor:          'pointer',
                transition:      'all 150ms ease',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {displayRating && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
            {RATING_LABELS[displayRating]}
          </p>
        )}
      </div>

      {/* ── What emerged ── */}
      <div className="mb-8">
        <label htmlFor="what_emerged" className="label">
          What emerged? <span style={{ textTransform: 'none', opacity: 0.7 }}>(optional)</span>
        </label>
        <textarea
          id="what_emerged"
          value={whatEmerged}
          onChange={e => setWhatEmerged(e.target.value)}
          placeholder="A question that opened up, something you understood differently, where the conversation went…"
          className="input"
          style={{ minHeight: '120px', resize: 'vertical' }}
          disabled={submitting}
          maxLength={2000}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-5 text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={submitting || !rating}
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>

    </form>
  )
}
