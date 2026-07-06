/**
 * app/api/match/route.ts
 *
 * POST /api/match — the core mechanism.
 *
 * Flow:
 *   1. Auth check
 *   2. Profile fetch + completeness check
 *   3. Subscription gate — SKIPPED in demo mode (config.stripe = false)
 *      The gate only fires when Stripe is actually configured. This makes
 *      the entire core loop (profile → match → session → feedback)
 *      testable and deployable with zero payment integration.
 *   4. Existing session / already-queued check
 *   5. Fetch queue candidates
 *   6. findBestMatch (Zadera → Groq → keyword fallback, via container)
 *   7. Create session + send emails (emails no-op if Gmail unconfigured)
 */

import { NextRequest, NextResponse }                from 'next/server'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase'
import { findBestMatch, selectSourceText }           from '@/lib/ai'
import { sendMatchedEmail }                          from '@/lib/gmail'
import { config }                                    from '@/lib/config'

// ── Slot generation ───────────────────────────────────────────────────────────
const SLOT_HOURS_UTC   = [9, 12, 16, 19]
const MIN_HOURS_AHEAD  = 2
const SLOTS_TO_PROPOSE = 3

function generateProposedSlots(): string[] {
  const now     = new Date()
  const minTime = new Date(now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000)
  const slots:  string[] = []

  for (let dayOffset = 0; dayOffset < 8 && slots.length < SLOTS_TO_PROPOSE; dayOffset++) {
    for (const hour of SLOT_HOURS_UTC) {
      if (slots.length >= SLOTS_TO_PROPOSE) break
      const candidate = new Date(now)
      candidate.setUTCDate(now.getUTCDate() + dayOffset)
      candidate.setUTCHours(hour, 0, 0, 0)
      if (candidate > minTime) slots.push(candidate.toISOString())
    }
  }

  return slots
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(_request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'profile_incomplete', message: 'Complete your profile first.' },
      { status: 400 }
    )
  }

  if (!profile.what_i_know?.trim() || !profile.what_i_want?.trim()) {
    return NextResponse.json(
      { error: 'profile_incomplete', message: 'Add what you know and want before matching.' },
      { status: 400 }
    )
  }

  // ── Subscription gate (skipped when Stripe is not configured) ─────────────
  // Demo mode: config.stripe = false → gate bypassed → full loop works.
  // Production: config.stripe = true → gate enforced → 402 if not subscribed.
  if (config.stripe && profile.subscription_status !== 'active') {
    return NextResponse.json({ error: 'subscription_required' }, { status: 402 })
  }

  // ── Existing session ──────────────────────────────────────────────────────
  const { data: existingSession } = await supabaseAdmin
    .from('sessions')
    .select('id, status')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .in('status', ['pending', 'active'])
    .maybeSingle()

  if (existingSession) {
    return NextResponse.json({ status: 'has_session', sessionId: existingSession.id })
  }

  // ── Already queued ────────────────────────────────────────────────────────
  if (profile.in_queue) {
    return NextResponse.json({ status: 'queued' })
  }

  // ── Fetch candidates ──────────────────────────────────────────────────────
  const { data: candidates } = await supabaseAdmin
    .from('profiles')
    .select('id, what_i_know, what_i_want, display_name')
    .eq('in_queue', true)
    .neq('id', user.id)

  if (!candidates || candidates.length === 0) {
    await supabaseAdmin
      .from('profiles')
      .update({ in_queue: true, queued_at: new Date().toISOString() })
      .eq('id', user.id)
    return NextResponse.json({ status: 'queued' })
  }

  // ── Match ────────────────────────────────────────────────────────────────
  let matchedId: string | null = null
  try {
    matchedId = await findBestMatch(
      { id: profile.id, what_i_know: profile.what_i_know, what_i_want: profile.what_i_want },
      candidates.map(c => ({ id: c.id, what_i_know: c.what_i_know, what_i_want: c.what_i_want }))
    )
  } catch (err) {
    console.error('[match] findBestMatch threw (should not happen — adapters absorb errors):', err)
  }

  if (!matchedId) {
    await supabaseAdmin
      .from('profiles')
      .update({ in_queue: true, queued_at: new Date().toISOString() })
      .eq('id', user.id)
    return NextResponse.json({ status: 'queued' })
  }

  const matchedProfile = candidates.find(c => c.id === matchedId)!

  // ── Source text ───────────────────────────────────────────────────────────
  let sourceTextId: string | null = null
  try {
    const { data: allTexts } = await supabaseAdmin
      .from('source_texts')
      .select('id, title, topic_tag')

    if (allTexts && allTexts.length > 0) {
      sourceTextId = await selectSourceText(
        { id: profile.id, what_i_know: profile.what_i_know, what_i_want: profile.what_i_want },
        { id: matchedProfile.id, what_i_know: matchedProfile.what_i_know, what_i_want: matchedProfile.what_i_want },
        allTexts
      )
    }
  } catch (err) {
    console.error('[match] selectSourceText threw:', err)
  }

  // ── Create session ────────────────────────────────────────────────────────
  const proposedSlots = generateProposedSlots()

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .insert({
      user_a:         user.id,
      user_b:         matchedId,
      source_text_id: sourceTextId,
      status:         'pending',
      proposed_slots: proposedSlots,
    })
    .select('id')
    .single()

  if (sessionError || !session) {
    console.error('[match] session creation failed:', sessionError)
    return NextResponse.json({ error: 'Failed to create session.' }, { status: 500 })
  }

  // ── Clear queue ───────────────────────────────────────────────────────────
  await supabaseAdmin
    .from('profiles')
    .update({ in_queue: false, queued_at: null })
    .in('id', [user.id, matchedId])

  // ── Send matched emails (no-op if Gmail unconfigured) ─────────────────────
  try {
    const [{ data: authA }, { data: authB }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(user.id),
      supabaseAdmin.auth.admin.getUserById(matchedId),
    ])

    await Promise.allSettled([
      authA.user?.email
        ? sendMatchedEmail({
            to:            authA.user.email,
            recipientName: profile.display_name,
            partnerName:   matchedProfile.display_name,
            partnerKnows:  matchedProfile.what_i_know.slice(0, 160),
            sessionId:     session.id,
            proposedSlots,
          })
        : Promise.resolve(),
      authB.user?.email
        ? sendMatchedEmail({
            to:            authB.user.email,
            recipientName: matchedProfile.display_name,
            partnerName:   profile.display_name,
            partnerKnows:  profile.what_i_know.slice(0, 160),
            sessionId:     session.id,
            proposedSlots,
          })
        : Promise.resolve(),
    ])
  } catch (err) {
    console.error('[match] email notifications failed:', err)
  }

  return NextResponse.json({ status: 'matched', sessionId: session.id })
}
