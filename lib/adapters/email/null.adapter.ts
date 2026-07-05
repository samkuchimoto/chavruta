/**
 * lib/adapters/email/null.adapter.ts
 *
 * Null email adapter — logs email intent to console, sends nothing.
 * Used when Gmail is not configured (GMAIL_* env vars absent).
 *
 * The log output is structured so you can see exactly what would
 * have been sent during local development:
 *   [email:null] matched → to: sam@example.com subject: "You've been matched"
 *
 * All methods return Promise<void> and never throw — the null adapter
 * is the "adapter that always works" by definition.
 */

import type {
  EmailPort,
  MatchedEmailParams,
  ReminderEmailParams,
  FeedbackEmailParams,
} from '@/lib/ports/email'

export class NullEmailAdapter implements EmailPort {

  async sendMatchedEmail(params: MatchedEmailParams): Promise<void> {
    console.log(
      `[email:null] matched → to: ${params.to} ` +
      `partner: ${params.partnerName} session: ${params.sessionId}`
    )
  }

  async sendSessionReminderEmail(params: ReminderEmailParams): Promise<void> {
    console.log(
      `[email:null] reminder → to: ${params.to} ` +
      `partner: ${params.partnerName} at: ${params.scheduledAt}`
    )
  }

  async sendFeedbackRequestEmail(params: FeedbackEmailParams): Promise<void> {
    console.log(
      `[email:null] feedback → to: ${params.to} ` +
      `partner: ${params.partnerName} session: ${params.sessionId}`
    )
  }
}
