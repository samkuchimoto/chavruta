/**
 * app/api/feedback/route.ts
 *
 * POST /api/feedback
 * Body: { session_id: string, rating: number, what_emerged: string | null }
 *
 * Unlike most other routes, this one uses the user-scoped client, not
 * supabaseAdmin. The chavruta.feedback RLS insert policy already enforces
 * exactly the rules we need:
 *   - user_id = auth.uid()              (can't submit feedback as someone else)
 *   - session participant                (user_a or user_b)
 *   - session.status = 'completed'       (no feedback before the session ends)
 *   - unique(session_id, user_id)        (DB constraint — no double submission)
 *
 * Letting Postgres enforce this means the route logic stays thin and the
 * single source of truth for "who can submit feedback" lives in one place
 * (the migration), not duplicated across RLS and application code.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

type FeedbackBody = {
  session_id?:   string
  rating?:       number
  what_emerged?: string | null
}

export async function POST(request: NextRequest) {

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: FeedbackBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sessionId   = body.session_id?.trim()
  const rating      = body.rating
  const whatEmerged = body.what_emerged?.trim() || null

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json({ error: 'rating must be an integer from 1 to 5' }, { status: 400 })
  }
  if (whatEmerged && whatEmerged.length > 2000) {
    return NextResponse.json({ error: 'what_emerged exceeds 2000 characters' }, { status: 400 })
  }

  // ── Insert — RLS enforces participant + completed-session + auth.uid() match
  const { data: feedback, error: insertError } = await supabase
    .from('feedback')
    .insert({
      session_id:   sessionId,
      user_id:      user.id,
      rating,
      what_emerged: whatEmerged,
    })
    .select()
    .single()

  if (insertError) {
    // Unique constraint violation → already submitted feedback for this session
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You\u2019ve already submitted feedback for this session.' },
        { status: 409 }
      )
    }

    // RLS rejection (not a participant, or session not completed) surfaces as
    // a generic permission error from Postgres — map it to something readable.
    console.error('[feedback] insert failed:', insertError)
    return NextResponse.json(
      { error: 'Could not submit feedback. The session may not be completed yet.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ feedback })
}
