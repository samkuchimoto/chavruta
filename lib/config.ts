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
 *   Muscle = Groq, Nomic, Stripe, Resend, Zadera. The core mechanism
 *   (describe → match → session → feedback) does not depend on any of
 *   these. Missing muscle degrades the experience — coarser matching,
 *   no emails, no paywall — it never crashes a route.
 *
 * Nothing in this file does I/O and nothing in it throws. It is safe to
 * import from anywhere, including Edge middleware, without side effects.
 *
 * ── Why `supabase` is computed differently from everything else below ──────
 * Next.js only inlines NEXT_PUBLIC_ vars into the browser bundle when the
 * full expression `process.env.NEXT_PUBLIC_X` appears literally in the
 * source. Dynamic access — `process.env[someVariable]` — is NOT inlined
 * (this is documented Next.js behavior, not a bug in their bundler). The
 * `has()` helper below builds its key from a variable, so any flag that
 * depends on it will silently evaluate to `false` in browser code, no
 * matter what's actually set in Vercel.
 * `supabase` is the one flag read from a Client Component
 * (createBrowserSupabaseClient, called from the signup/login pages), so it
 * must use static literal reads instead. Everything else here (groq, nomic,
 * stripe, resend, zadera, supabaseAdmin's service-role half) is only ever
 * read server-side, where process.env is the real runtime object and
 * dynamic access works fine — so `has()` remains correct and safe for those.
 */

function has(...keys: string[]): boolean {
  return keys.every(k => {
    const v = process.env[k]
    return typeof v === 'string' && v.trim().length > 0
  })
}

// Static literal reads — required so Next.js can actually inline these
// into the client bundle. Do not refactor this into has(), and do not
// destructure process.env — both break inlining the same way.
const supabaseUrlSet  = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string'
  && process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0
const supabaseAnonSet = typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string'
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length > 0

export const config = {
  // ── Skeleton ────────────────────────────────────────────────────────────
  supabase:      supabaseUrlSet && supabaseAnonSet,
  supabaseAdmin: supabaseUrlSet && has('SUPABASE_SERVICE_ROLE_KEY'),

  // ── Muscle ──────────────────────────────────────────────────────────────
  groq:          has('GROQ_API_KEY'),
  nomic:         has('NOMIC_API_KEY'),
  zadera:        has('ZADERA_API_KEY', 'ZADERA_API_URL'),
  stripe:        has('STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'),
  stripeWebhook: has('STRIPE_WEBHOOK_SECRET'),
  resend:        has('RESEND_API_KEY', 'RESEND_FROM_ADDRESS'),
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
    ['resend', config.resend],
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
