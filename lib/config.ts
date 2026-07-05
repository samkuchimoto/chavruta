/**
 * lib/config.ts
 *
 * Central capability detection. Every other module asks "is X configured?"
 * here instead of scattering process.env checks across the codebase.
 *
 * Philosophy — skeleton vs muscle:
 *   Skeleton = Supabase. The app has no reason to exist without a database.
 *   If it's missing, fail loud and early — a silent half-working app is
 *   worse than a clear error pointing at the missing env var.
 *
 *   Muscle = Groq, Nomic, Stripe, Gmail, Zadera. The core mechanism
 *   (describe → match → session → feedback) does not depend on any of
 *   these. Missing muscle degrades the experience — coarser matching,
 *   no emails, no paywall — it never crashes a route.
 *
 * Nothing in this file does I/O and nothing in it throws. It is safe to
 * import from anywhere, including Edge middleware, without side effects.
 */

function has(...keys: string[]): boolean {
  return keys.every(k => {
    const v = process.env[k]
    return typeof v === 'string' && v.trim().length > 0
  })
}

export const config = {
  // ── Skeleton ────────────────────────────────────────────────────────────
  supabase:      has('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseAdmin: has('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),

  // ── Muscle ──────────────────────────────────────────────────────────────
  groq:          has('GROQ_API_KEY'),
  nomic:         has('NOMIC_API_KEY'),
  zadera:        has('ZADERA_API_KEY', 'ZADERA_API_URL'),
  stripe:        has('STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'),
  stripeWebhook: has('STRIPE_WEBHOOK_SECRET'),
  gmail:         has('GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_FROM_ADDRESS'),
} as const

export type Config = typeof config

// ── One-time boot log ─────────────────────────────────────────────────────
// Visible in Vercel function logs. Answers "why is matching using the
// keyword fallback?" in five seconds instead of a debugging session.
// Module-level `logged` is per cold-start, not per-request — cheap and fine.

let logged = false

export function logConfigOnce(): void {
  if (logged) return
  logged = true

  const muscle = [
    ['groq', config.groq],
    ['nomic', config.nomic],
    ['zadera', config.zadera],
    ['stripe', config.stripe],
    ['gmail', config.gmail],
  ] as const

  const missing = muscle.filter(([, ok]) => !ok).map(([name]) => name)

  if (!config.supabase) {
    console.warn(
      '[config] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing. ' +
      'The app cannot read or write data until these are set.'
    )
  }

  if (missing.length > 0) {
    console.warn(
      `[config] Running without: ${missing.join(', ')}. ` +
      'Core loop still works — these are optional and degrade gracefully.'
    )
  }
}
