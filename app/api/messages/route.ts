/**
 * app/api/messages/route.ts
 *
 * POST /api/messages
 * Body: { session_id: string, content: string }
 *
 * The first message sent in a pending session transitions it to active
 * and sets started_at — this is what starts the 45-minute timer on the client.
 *
 * Authorization enforced manually (admin client used throughout);
 * participant check runs before any write.
 *
 * Supabase Realtime delivers new messages to the session thread —
 * this route only needs to insert the row.
 * (Enable realtime on chavruta.messages in the Supabase dashboard.)
 *
 * Timer enforcement is client-side only: the Timer component calls
 * PATCH /api/sessions/[id] { action: 'end' } when 45 minutes elapse.
 * Server does not reject messages based on time — the client owns the clock.
 */

import { NextRequest, NextResponse }               from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'

const MAX_MESSAGE_LENGTH = 4000  // characters — safety ceiling, not shown in UI

export async function POST(request: NextRequest) {

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { session_id?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionId = body.session_id?.trim()
  const content   = body.content?.trim()

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    )
  }

  // ── Fetch session ────────────────────────────────────────────────────────────
  const { data: session, error: fetchError } = await supabaseAdmin
    .from('sessions')
    .select('id, user_a, user_b, status, accepted_a, accepted_b, started_at')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // ── Authorize ─────────────────────────────────────────────────────────────────
  const iAmA = session.user_a === user.id
  const iAmB = session.user_b === user.id

  if (!iAmA && !iAmB) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── State gate ────────────────────────────────────────────────────────────────
  let sessionStarted = false

  if (session.status === 'pending') {
    // First message only allowed once both users have accepted
    if (!session.accepted_a || !session.accepted_b) {
      return NextResponse.json(
        {
          error:   'session_not_ready',
          message: 'Both participants must choose a slot before the session can begin.',
        },
        { status: 409 }
      )
    }

    // Transition: pending → active. The .eq('status', 'pending') guard prevents
    // a race condition where both users send their first message simultaneously —
    // only one update wins; the other's insert still proceeds (session is now active).
    const { error: startError } = await supabaseAdmin
      .from('sessions')
      .update({
        status:     'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('status', 'pending')

    if (startError) {
      // Re-fetch to check if partner's concurrent message already started it
      const { data: refetched } = await supabaseAdmin
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()

      if (refetched?.status !== 'active') {
        console.error('[messages] session start failed:', startError)
        return NextResponse.json({ error: 'Could not start session' }, { status: 500 })
      }
      // Partner beat us to it — session is active, proceed with insert
    } else {
      sessionStarted = true
    }

  } else if (session.status === 'active') {
    sessionStarted = false

  } else {
    // completed or no-show
    return NextResponse.json(
      { error: 'session_closed', message: 'This session has ended.' },
      { status: 409 }
    )
  }

  // ── Insert message ────────────────────────────────────────────────────────────
  const { data: message, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      session_id: sessionId,
      sender_id:  user.id,
      content,
    })
    .select()
    .single()

  if (insertError || !message) {
    console.error('[messages] insert failed:', insertError)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // started: true → client initialises the 45-minute countdown
  return NextResponse.json({ message, started: sessionStarted })
}
