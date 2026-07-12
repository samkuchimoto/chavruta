function has(...keys: string[]): boolean {
  return keys.every(k => {
    const v = process.env[k]
    return typeof v === 'string' && v.trim().length > 0
  })
}

const supabaseUrlSet  = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string'
  && process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0
const supabaseAnonSet = typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string'
  && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length > 0

export const config = {
  supabase:      supabaseUrlSet && supabaseAnonSet,
  supabaseAdmin: supabaseUrlSet && has('SUPABASE_SERVICE_ROLE_KEY'),
  groq:          has('GROQ_API_KEY'),
  nomic:         has('NOMIC_API_KEY'),
  zadera:        has('ZADERA_API_KEY', 'ZADERA_API_URL'),
  stripe:        has('STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID'),
  stripeWebhook: has('STRIPE_WEBHOOK_SECRET'),
  resend:        has('RESEND_API_KEY', 'RESEND_FROM_ADDRESS'),
} as const

export type Config = typeof config

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
    console.warn('[config] Supabase env vars missing.')
  }
  if (missing.length > 0) {
    console.warn(`[config] Running without: ${missing.join(', ')}.`)
  }
}