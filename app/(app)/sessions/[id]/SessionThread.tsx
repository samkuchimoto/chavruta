/**
 * app/(app)/sessions/[id]/SessionThread.tsx
 *
 * Shown when session.status === 'active' (or 'pending' with both accepted,
 * to allow early start — see flag in page.tsx).
 *
 * Combines the message thread and the 45-minute timer in one component
 * because they share one piece of state: started_at. The timer doesn't
 * exist independently of the thread — it starts the instant the first
 * message is sent, which is also what makes this component meaningful.
 *
 * Realtime: subscribes to INSERT on chavruta.messages filtered by session_id.
 * Own messages are appended optimistically on send; the realtime event for
 * them is deduped by id when it arrives.
 *
 * Timer auto-ends the session via PATCH when it reaches zero, then redirects
 * to the feedback page. Manual "End session" button does the same.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter }                   from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Message }                from '@/lib/supabase'

const SESSION_LENGTH_SECONDS = 45 * 60
const URGENT_THRESHOLD       = 5 * 60   // last 5 min — accent color
const PULSE_THRESHOLD        = 2 * 60   // last 2 min — subtle pulse

type Props = {
  sessionId:       string
  currentUserId:   string
  partnerName:     string
  initialMessages: Message[]
  startedAt:       string | null   // null if not yet started (shouldn't happen here, but defensive)
}

// ── Timer formatting ─────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function SessionThread({
  sessionId,
  currentUserId,
  partnerName,
  initialMessages,
  startedAt,
}: Props) {
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft,     setDraft]   = useState('')
  const [sending,   setSending] = useState(false)
  const [error,     setError]   = useState<string | null>(null)
  const [ending,    setEnding]  = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const endedRef   = useRef(false)   // guards against double-firing auto-end

  // ── Remaining time, computed from startedAt — not a naive countdown.
  // This stays correct across tab backgrounding, reloads, and slow clocks.
  const [remaining, setRemaining] = useState<number>(() => {
    if (!startedAt) return SESSION_LENGTH_SECONDS
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    return SESSION_LENGTH_SECONDS - elapsed
  })

  // ── End session (shared by timer expiry and manual button) ────────────────
  const endSession = useCallback(async () => {
    if (endedRef.current) return
    endedRef.current = true
    setEnding(true)

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'end' }),
      })
    } catch (err) {
      console.error('[session] end failed:', err)
      // Proceed to feedback regardless — user shouldn't be stuck
    }

    router.push(`/feedback/${sessionId}`)
  }, [sessionId, router])

  // ── Timer tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startedAt) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const left = SESSION_LENGTH_SECONDS - elapsed
      setRemaining(left)

      if (left <= 0) {
        clearInterval(interval)
        endSession()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt, endSession])

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const channel = supabase
      .channel(`session-${sessionId}-messages`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'chavruta',
          table:  'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages(prev =>
            prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // ── Auto-scroll to latest message ────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // ── Send message ──────────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setError(null)
    setDraft('')

    try {
      const res = await fetch('/api/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionId, content }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Could not send message.')
        setDraft(content)   // restore draft so nothing is lost
        setSending(false)
        return
      }

      // Optimistic append — realtime event for this message will be deduped
      setMessages(prev =>
        prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]
      )

      // If this was the first message, the timer needs startedAt —
      // simplest correct approach: reload the page data via refresh.
      if (data.started) {
        router.refresh()
      }

    } catch {
      setError('Network error. Your message was not sent.')
      setDraft(content)
    } finally {
      setSending(false)
    }
  }

  // ── Timer visual state ───────────────────────────────────────────────────────
  const timerClass = [
    'timer-display',
    remaining <= 0 ? 'timer-done' : remaining <= URGENT_THRESHOLD ? 'timer-urgent' : '',
    remaining > 0 && remaining <= PULSE_THRESHOLD ? 'animate-pulse-subtle' : '',
  ].filter(Boolean).join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Timer ── */}
      <div
        style={{
          textAlign:    'center',
          padding:      '2rem 0 1.5rem',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <p className={timerClass}>{formatTime(remaining)}</p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
          with {partnerName}
        </p>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        style={{
          flex:           1,
          overflowY:      'auto',
          padding:        '1.5rem',
          display:        'flex',
          flexDirection:  'column',
          gap:            '0.625rem',
        }}
      >
        {messages.length === 0 && (
          <p
            className="text-sm text-center"
            style={{ color: 'var(--color-muted)', marginTop: '2rem' }}
          >
            Send the first message to start your 45 minutes.
          </p>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={m.sender_id === currentUserId ? 'message-bubble-own' : 'message-bubble-partner'}
            style={{
              maxWidth:     '75%',
              padding:      '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              fontSize:     'var(--text-sm)',
              lineHeight:   'var(--leading-relaxed)',
              wordBreak:    'break-word',
              marginLeft:   m.sender_id === currentUserId ? 'auto' : '0',
              marginRight:  m.sender_id === currentUserId ? '0' : 'auto',
            }}
          >
            {m.content}
          </div>
        ))}
      </div>

      {/* ── Composer ── */}
      <form
        onSubmit={handleSend}
        style={{
          display:      'flex',
          gap:          '0.625rem',
          padding:      '1rem 1.5rem',
          borderTop:    '1px solid var(--color-border-subtle)',
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={remaining <= 0 ? 'Session ended' : 'Write something…'}
          className="input"
          disabled={sending || remaining <= 0}
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !draft.trim() || remaining <= 0}
        >
          Send
        </button>
      </form>

      {error && (
        <p
          className="text-xs"
          style={{ color: 'var(--color-destructive)', padding: '0 1.5rem 0.75rem' }}
        >
          {error}
        </p>
      )}

      {/* ── End session ── */}
      <div style={{ padding: '0 1.5rem 1.5rem', textAlign: 'center' }}>
        <button
          onClick={endSession}
          disabled={ending}
          className="btn btn-ghost"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}
        >
          {ending ? 'Ending…' : 'End session early'}
        </button>
      </div>

    </div>
  )
}
