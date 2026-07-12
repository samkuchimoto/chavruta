import { NextResponse } from 'next/server'
import { config }       from '@/lib/config'

export async function GET() {
  const adapters = {
    matching: config.groq
      ? config.zadera ? 'zadera' : 'groq'
      : 'keyword-fallback',
    email:   config.resend  ? 'resend'          : 'null (console log)',
    payment: config.stripe  ? 'stripe'          : 'null (demo mode)',
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
      resend:   config.resend,
    },
    notes: {
      subscriptionGate,
    },
  })
}