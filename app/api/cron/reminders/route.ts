/**
 * app/api/cron/reminders/route.ts
 *
 * GET /api/cron/reminders
 *
 * Vercel Cron Job — runs every hour (see vercel.json).
 * Finds sessions scheduled to start within the next ~65 minutes
 * (65-minute window handles the ±5 minute cron imprecision on Vercel Hobby)
 * and sends reminder emails to both participants.
 *
 * Auth: CRON_SECRET header. Vercel injects this automatically when the
 * cron is configured — set CRON_SECRET in your Vercel env vars.
 *
 * Email: no-op if Gmail is not configured (NullEmailAdapter logs instead).
 * The cron still runs; it just doesn't send anything.
 *
 * No-show detection: sessions that were 'pending' (never started) at the
 * scheduled time are marked 'no-show'. This frees both users to re-queue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import { sendSessionReminderEmail }  from '@/lib/gmail'

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')

  if (
    process.env.CRON_SECRET &&
    cronSecret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now        = new Date()
  const inOneHour  = new Date(now.getTime() + 65 * 60 * 1000)
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

  // ── Send reminders ────────────────────────────────────────────────────────
  const { data: upcomingSessions } = await supabaseAdmin
    .from('sessions')
    .select('id, user_a, user_b, scheduled_at, source_text_id')
    .eq('status', 'pending')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', inOneHour.toISOString())

  let remindersCount = 0

  for (const session of upcomingSessions ?? []) {
    try {
      // Fetch source text title if available
      let textTitle = 'Your assigned text'
      if (session.source_text_id) {
        const { data: text } = await supabaseAdmin
          .from('source_texts')
          .select('title')
          .eq('id', session.source_text_id)
          .maybeSingle()
        if (text?.title) textTitle = text.title
      }

      // Fetch both users' display names and emails
      const [profileA, profileB, authA, authB] = await Promise.all([
        supabaseAdmin.from('profiles').select('display_name').eq('id', session.user_a).maybeSingle(),
        supabaseAdmin.from('profiles').select('display_name').eq('id', session.user_b).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(session.user_a),
        supabaseAdmin.auth.admin.getUserById(session.user_b),
      ])

      const nameA  = profileA.data?.display_name ?? 'there'
      const nameB  = profileB.data?.display_name ?? 'there'
      const emailA = authA.data.user?.email
      const emailB = authB.data.user?.email

      await Promise.allSettled([
        emailA
          ? sendSessionReminderEmail({
              to:              emailA,
              recipientName:   nameA,
              partnerName:     nameB,
              scheduledAt:     session.scheduled_at!,
              sourceTextTitle: textTitle,
              sessionId:       session.id,
            })
          : Promise.resolve(),
        emailB
          ? sendSessionReminderEmail({
              to:              emailB,
              recipientName:   nameB,
              partnerName:     nameA,
              scheduledAt:     session.scheduled_at!,
              sourceTextTitle: textTitle,
              sessionId:       session.id,
            })
          : Promise.resolve(),
      ])

      remindersCount++
    } catch (err) {
      console.error(`[cron/reminders] failed for session ${session.id}:`, err)
    }
  }

  // ── Mark no-shows ─────────────────────────────────────────────────────────
  // Sessions still 'pending' with a scheduled_at more than 5 minutes in the
  // past never started — mark them no-show so users can re-queue.
  const { data: noShows } = await supabaseAdmin
    .from('sessions')
    .update({ status: 'no-show' })
    .eq('status', 'pending')
    .not('scheduled_at', 'is', null)
    .lt('scheduled_at', fiveMinAgo.toISOString())
    .select('id')

  const noShowCount = noShows?.length ?? 0

  return NextResponse.json({
    ok:          true,
    reminders:   remindersCount,
    noShows:     noShowCount,
    ranAt:       now.toISOString(),
  })
}
