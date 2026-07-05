/**
 * app/api/health/route.ts
 *
 * GET /api/health
 *
 * Returns which capabilities are configured and which are in fallback mode.
 * No secrets exposed — only boolean flags and adapter names.
 *
 * Use after every deploy to verify the right adapters are active:
 *
 *   curl https://your-project.vercel.app/api/health | jq
 *
 * Expected output on a full production deploy:
 * {
 *   "status": "ok",
 *   "adapters": {
 *     "matching": "groq",
 *     "email":    "gmail",
 *     "payment":  "stripe"
 *   },
 *   "capabilities": {
 *     "supabase": true,
 *     "groq":     true,
 *     "nomic":    true,
 *     "stripe":   true,
 *     "gmail":    true,
 *     "zadera":   false
 *   }
 * }
 *
 * Expected output on a skeleton deploy (only Supabase set):
 * {
 *   "status": "ok",
 *   "adapters": {
 *     "matching": "keyword-fallback",
 *     "email":    "null (console log)",
 *     "payment":  "null (demo mode)"
 *   },
 *   ...
 * }
 */

import { NextResponse } from 'next/server'
import { config }       from '@/lib/config'

export async function GET() {
  const adapters = {
    matching: config.groq
      ? config.zadera ? 'zadera' : 'groq'
      : 'keyword-fallback',
    email:   config.gmail   ? 'gmail'           : 'null (console log)',
    payment: config.stripe  ? 'stripe'           : 'null (demo mode)',
  }

  const subscriptionGate = config.stripe
    ? 'active — subscription required to match'
    : 'bypassed — demo mode, all users can match'

  return NextResponse.json({
    status:   'ok',
    adapters,
    capabilities: {
      supabase: config.supabase,
      groq:     config.groq,
      nomic:    config.nomic,
      zadera:   config.zadera,
      stripe:   config.stripe,
      gmail:    config.gmail,
    },
    notes: {
      subscriptionGate,
    },
  })
}
