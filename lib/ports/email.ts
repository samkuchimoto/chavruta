/**
 * lib/ports/email.ts
 *
 * Email port — the domain's contract for transactional notifications.
 *
 * Zero imports from Nodemailer, Gmail, Resend, or any email provider.
 * Swapping providers means writing a new adapter, not touching any domain code.
 *
 * All methods return Promise<void> and NEVER throw — a failed notification
 * must never crash the operation that triggered it (matching, session end).
 */

// ── Param types ──────────────────────────────────────────────────────────────
// Plain data objects — no provider-specific types.

export type MatchedEmailParams = {
  to:            string
  recipientName: string
  partnerName:   string
  partnerKnows:  string        // snippet of partner's what_i_know
  sessionId:     string
  proposedSlots: string[]      // ISO timestamp strings
}

export type ReminderEmailParams = {
  to:              string
  recipientName:   string
  partnerName:     string
  scheduledAt:     string      // ISO timestamp
  sourceTextTitle: string
  sessionId:       string
}

export type FeedbackEmailParams = {
  to:            string
  recipientName: string
  partnerName:   string
  sessionId:     string
}

// ── Port interface ───────────────────────────────────────────────────────────

export interface EmailPort {
  /** "You've been matched" — sent to both users on session creation. */
  sendMatchedEmail(params: MatchedEmailParams): Promise<void>

  /** "Your session starts in one hour" — sent by the reminder cron. */
  sendSessionReminderEmail(params: ReminderEmailParams): Promise<void>

  /** "How did it go?" — sent to both users when a session ends. */
  sendFeedbackRequestEmail(params: FeedbackEmailParams): Promise<void>
}
