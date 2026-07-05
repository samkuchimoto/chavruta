/**
 * app/(app)/sessions/[id]/SlotPicker.tsx
 *
 * Shown when session.status === 'pending'.
 * Renders the 3 proposed slots; selecting one PATCHes the session
 * (action: 'choose_slot'), which also implicitly accepts the match.
 *
 * Slots are formatted in the browser's local timezone — proposed_slots
 * are stored as UTC ISO strings, so this is correct without any
 * timezone library.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  sessionId:      string
  proposedSlots:  string[]
  myChoice:       string | null   // slot_choice_a or _b for the current user
  partnerChoice:  string | null   // the other user's choice, if made
  partnerName:    string
}

function formatSlot(iso: string): { weekday: string; date: string; time: string } {
  const d = new Date(iso)
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    date:    d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
    time:    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}

export function SlotPicker({
  sessionId,
  proposedSlots,
  myChoice,
  partnerChoice,
  partnerName,
}: Props) {
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  async function handleChoose(slot: string) {
    setSelecting(slot)
    setError(null)

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'choose_slot', slot }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not save your choice. Try again.')
        setSelecting(null)
        return
      }

      router.refresh()
    } catch {
      setError('Network error. Try again.')
      setSelecting(null)
    }
  }

  return (
    <div>
      {partnerChoice && !myChoice && (
        <p
          className="text-sm mb-5"
          style={{ color: 'var(--color-accent)' }}
        >
          {partnerName} has already chosen a time.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {proposedSlots.map(slot => {
          const { weekday, date, time } = formatSlot(slot)
          const isMine     = myChoice === slot
          const isPartners = partnerChoice === slot
          const isPending  = selecting === slot

          return (
            <button
              key={slot}
              onClick={() => handleChoose(slot)}
              disabled={!!myChoice || isPending}
              className="card"
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'space-between',
                cursor:          myChoice ? 'default' : 'pointer',
                textAlign:       'left',
                width:           '100%',
                borderColor:     isMine ? 'var(--color-accent)' : 'var(--color-border)',
                backgroundColor: isMine ? 'var(--color-accent-glow)' : 'var(--color-surface)',
                opacity:         myChoice && !isMine ? 0.5 : 1,
                transition:      'all 150ms ease',
              }}
            >
              <div>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                  {weekday}, {date}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {time}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isPartners && (
                  <span className="badge badge-pending">{partnerName.split(' ')[0]}</span>
                )}
                {isMine && (
                  <span className="badge badge-active">Your choice</span>
                )}
                {isPending && (
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Saving…
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm mt-4" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      {myChoice && !partnerChoice && (
        <p className="text-xs mt-5" style={{ color: 'var(--color-muted)' }}>
          Waiting for {partnerName} to choose. You'll get an email once the time is confirmed.
        </p>
      )}
    </div>
  )
}
