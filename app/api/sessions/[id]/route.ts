/**
 * app/api/sessions/[id]/route.ts
 *
 * PATCH /api/sessions/[id]
 *
 * Handles the two user-triggered state transitions:
 *
 *   choose_slot  — user picks a slot from proposed_slots.
 *                  Implicitly accepts the match (sets accepted_a/b).
 *                  When both have chosen, resolves scheduled_at.
 *
 *   end          — user or timer ends the session.
 *                  Sets status = 'completed', ended_at = now().
 *                  Sends feedback request emails to both participants.
 *
 * start is not here — it's triggered by the first message in /api/messages.
 * no_show is handled by /api/cron/reminders, not a user action.
 *
 * Authorization: only session participants (user_a or user_b) can PATCH.
 */

import { NextRequest, NextResponse }               from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { sendFeedbackRequestEmail }                from '@/lib/gmail'

// ── Slot resolution ───────────────────────────────────────────────────────────
// Both users pick one slot from the server-proposed list.
// If they agree → use it. If not → whichever proposed slot comes first.
// This guarantees a resolution without another round-trip.

function resolveSlot(
  proposedSlots: string[],
  slotA:         string | null,
  slotB:         string | null
): string | null {
  if (!slotA || !slotB) return null          // both must choose before we resolve

  if (slotA === slotB) return slotA          // agreement

  // Different choices: use whichever appears earlier in the proposed list.
  // Ties are impossible (strict ordering in proposed_slots).
  const iA = proposedSlots.indexOf(slotA)
  const iB = proposedSlots.indexOf(slotB)

  if (iA === -1 && iB === -1) return proposedSlots[0] ?? null  // invalid choices, use first
  if (iA === -1) return slotB
  if (iB === -1) return slotA

  return iA < iB ? slotA : slotB
}

// ── Route handler ─────────────────────────────────────────────────────────────

type Params = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: sessionId } = params

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: { action: string; slot?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, slot } = body

  // ── Fetch session ────────────────────────────────────────────────────────────
  const { data: session, error: fetchError } = await supabaseAdmin
    .from('sessions')
    .select('*')
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

  // ── Action: choose_slot ───────────────────────────────────────────────────────
  if (action === 'choose_slot') {
    if (!slot) {
      return NextResponse.json({ error: 'slot is required' }, { status: 400 })
    }

    if (!session.proposed_slots.includes(slot)) {
      return NextResponse.json({ error: 'Slot not in proposed list' }, { status: 400 })
    }

    if (session.status !== 'pending') {
      return NextResponse.json({ error: 'Session is not pending' }, { status: 409 })
    }

    // Build the update: set this user's choice + mark them as accepted
    const slotUpdate = iAmA
      ? { slot_choice_a: slot, accepted_a: true }
      : { slot_choice_b: slot, accepted_b: true }

    // Compute the resolved scheduled_at after this update
    const updatedSlotA = iAmA ? slot : session.slot_choice_a
    const updatedSlotB = iAmA ? session.slot_choice_b : slot
    const resolvedSlot = resolveSlot(session.proposed_slots, updatedSlotA, updatedSlotB)

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({
        ...slotUpdate,
        ...(resolvedSlot ? { scheduled_at: resolvedSlot } : {}),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('[session] choose_slot update failed:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      session:      updated,
      scheduled_at: resolvedSlot,
      resolved:     !!resolvedSlot,
    })
  }

  // ── Action: end ───────────────────────────────────────────────────────────────
  if (action === 'end') {
    if (session.status !== 'active') {
      // Idempotent — if already completed, return success
      if (session.status === 'completed') {
        return NextResponse.json({ session })
      }
      return NextResponse.json({ error: 'Session is not active' }, { status: 409 })
    }

    const endedAt = new Date().toISOString()

    const { data: ended, error: endError } = await supabaseAdmin
      .from('sessions')
      .update({ status: 'completed', ended_at: endedAt })
      .eq('id', sessionId)
      .select()
      .single()

    if (endError) {
      console.error('[session] end update failed:', endError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // ── Send feedback request emails ────────────────────────────────────────
    // Fetch both users' names and emails.
    // Failures are logged but don't affect the response.
    try {
      const [profileA, profileB] = await Promise.all([
        supabaseAdmin.from('profiles').select('display_name').eq('id', session.user_a).single(),
        supabaseAdmin.from('profiles').select('display_name').eq('id', session.user_b).single(),
      ])

      const [authA, authB] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(session.user_a),
        supabaseAdmin.auth.admin.getUserById(session.user_b),
      ])

      const emailA    = authA.data.user?.email
      const emailB    = authB.data.user?.email
      const nameA     = profileA.data?.display_name ?? 'there'
      const nameB     = profileB.data?.display_name ?? 'there'

      await Promise.allSettled([
        emailA
          ? sendFeedbackRequestEmail({
              to:            emailA,
              recipientName: nameA,
              partnerName:   nameB,
              sessionId,
            })
          : Promise.resolve(),
        emailB
          ? sendFeedbackRequestEmail({
              to:            emailB,
              recipientName: nameB,
              partnerName:   nameA,
              sessionId,
            })
          : Promise.resolve(),
      ])
    } catch (err) {
      console.error('[session] feedback email failed:', err)
    }

    return NextResponse.json({ session: ended })
  }

  // ── Unknown action ────────────────────────────────────────────────────────────
  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 }
  )
}
