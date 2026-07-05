/**
 * lib/gmail.ts — public shim for email operations
 *
 * Delegates entirely to container.email.
 * All existing imports (`import { sendMatchedEmail } from '@/lib/gmail'`)
 * continue to work. Real vs. null adapter is determined by the container.
 */

import { container } from '@/lib/container'

// Re-export param types so call sites can import them from '@/lib/gmail' as before
export type {
  MatchedEmailParams,
  ReminderEmailParams,
  FeedbackEmailParams,
} from '@/lib/ports/email'

export const sendMatchedEmail         = container.email.sendMatchedEmail.bind(container.email)
export const sendSessionReminderEmail = container.email.sendSessionReminderEmail.bind(container.email)
export const sendFeedbackRequestEmail = container.email.sendFeedbackRequestEmail.bind(container.email)
