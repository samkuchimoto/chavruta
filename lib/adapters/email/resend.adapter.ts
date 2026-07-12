/**
 * lib/adapters/email/resend.adapter.ts
 *
 * Resend implementation of EmailPort.
 *
 * Requires: RESEND_API_KEY, RESEND_FROM_ADDRESS (both checked in
 *           lib/config.ts before this adapter is selected in the container).
 *
 * RESEND_FROM_ADDRESS must be on a domain you've verified in the Resend
 * dashboard (Domains → Add Domain → add the DNS records they give you).
 * You cannot send "from" a bare Gmail/Outlook/etc. address the way the old
 * Gmail adapter could — Resend requires a domain you control and verify.
 *
 * All methods absorb their own errors — a failed send logs and returns,
 * never propagates to the caller. This adapter fulfils the EmailPort
 * contract that says "never throw."
 *
 * Content guardrail: no pain, therapy, or health framing in any copy.
 */

import { Resend } from 'resend'
import type {
  EmailPort,
  MatchedEmailParams,
  ReminderEmailParams,
  FeedbackEmailParams,
} from '@/lib/ports/email'

// ── Inline styles (email clients strip external CSS) ────────────────────────
const S = {
  wrapper: 'font-family:Georgia,serif;background:#fff;color:#111;max-width:560px;margin:0 auto;padding:48px 32px;line-height:1.7;font-size:16px',
  wordmark: 'font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#A8916A;text-decoration:none',
  divider: 'border:none;border-top:1px solid #e5e5e5;margin:32px 0',
  heading: 'font-size:22px;font-weight:normal;margin:0 0 20px;color:#111;line-height:1.4',
  body: 'margin:0 0 16px;color:#333',
  callout: 'background:#fafafa;border-left:3px solid #A8916A;padding:16px 20px;margin:24px 0;font-style:italic;color:#444',
  cta: 'display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;font-family:Georgia,serif;font-size:15px;margin:8px 0',
  footer: 'margin-top:48px;font-size:12px;color:#999',
}

function wrap(content: string): string {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff;">
<div style="${S.wrapper}">
  <p><a href="${url}" style="${S.wordmark}">Chavruta</a></p>
  <hr style="${S.divider}" />
  ${content}
  <hr style="${S.divider}" />
  <p style="${S.footer}">You're receiving this because you have an active Chavruta account.</p>
</div></body></html>`
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class ResendEmailAdapter implements EmailPort {

  private client: Resend | null = null

  private getClient(): Resend {
    if (this.client) return this.client
    this.client = new Resend(process.env.RESEND_API_KEY)
    return this.client
  }

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      const { error } = await this.getClient().emails.send({
        from:    `Chavruta <${process.env.RESEND_FROM_ADDRESS}>`,
        to,
        subject,
        html,
        text,
      })
      if (error) {
        console.error(`[resend] send failed "${subject}" → ${to}:`, error)
      }
    } catch (err) {
      console.error(`[resend] send threw "${subject}" → ${to}:`, err)
    }
  }

  async sendMatchedEmail(p: MatchedEmailParams): Promise<void> {
    const sessionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sessions/${p.sessionId}`

    const slotLines = p.proposedSlots
      .map(iso => new Date(iso).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        timeZone: 'Europe/Paris',
      }))
      .map(s => `<li style="margin:4px 0">${s}</li>`)
      .join('')

    const html = wrap(`
      <h1 style="${S.heading}">Your chavruta is ready.</h1>
      <p style="${S.body}">${p.recipientName}, you've been matched with <strong>${p.partnerName}</strong>.</p>
      <div style="${S.callout}">${p.partnerName} brings: ${p.partnerKnows}</div>
      <p style="${S.body}">Choose a time for your session.</p>
      <ul style="padding-left:20px;color:#333;margin:16px 0">${slotLines}</ul>
      <a href="${sessionUrl}" style="${S.cta}">Choose your slot</a>
      <p style="margin-top:24px;${S.body}">45 minutes. No agenda, no teacher.</p>
    `)

    const text = [
      `Your chavruta is ready, ${p.recipientName}.`,
      `Matched with: ${p.partnerName}`,
      `They bring: ${p.partnerKnows}`,
      ``,
      `Slots:`,
      ...p.proposedSlots.map(iso => `  • ${new Date(iso).toISOString()}`),
      ``,
      `Open: ${sessionUrl}`,
    ].join('\n')

    await this.send(p.to, `You've been matched — Chavruta`, html, text)
  }

  async sendSessionReminderEmail(p: ReminderEmailParams): Promise<void> {
    const sessionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sessions/${p.sessionId}`
    const time = new Date(p.scheduledAt).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'Europe/Paris',
    })

    const html = wrap(`
      <h1 style="${S.heading}">Your session starts in one hour.</h1>
      <p style="${S.body}">${p.recipientName}, you meet ${p.partnerName} at <strong>${time}</strong>.</p>
      <div style="${S.callout}">Today's text: ${p.sourceTextTitle}</div>
      <p style="${S.body}">The 45-minute timer starts when the first message is sent.</p>
      <a href="${sessionUrl}" style="${S.cta}">Open the session</a>
    `)

    const text = [
      `Session in one hour.`,
      `${p.recipientName} meets ${p.partnerName} at ${time}.`,
      `Text: ${p.sourceTextTitle}`,
      ``,
      `Open: ${sessionUrl}`,
    ].join('\n')

    await this.send(p.to, `Your session starts in one hour — ${p.partnerName}`, html, text)
  }

  async sendFeedbackRequestEmail(p: FeedbackEmailParams): Promise<void> {
    const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/feedback/${p.sessionId}`

    const html = wrap(`
      <h1 style="${S.heading}">How did it go?</h1>
      <p style="${S.body}">${p.recipientName}, your session with ${p.partnerName} has ended.</p>
      <p style="${S.body}">Two questions — takes less than a minute.</p>
      <a href="${feedbackUrl}" style="${S.cta}">Leave feedback</a>
    `)

    const text = [
      `How did it go, ${p.recipientName}?`,
      `Session with ${p.partnerName} ended.`,
      ``,
      `Feedback: ${feedbackUrl}`,
    ].join('\n')

    await this.send(p.to, `How was your session with ${p.partnerName}? — Chavruta`, html, text)
  }
}
