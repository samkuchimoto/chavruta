/**
 * app/api/stripe/portal/route.ts — GET, redirects to Stripe Customer Portal
 */

import { NextResponse }               from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createPortalSession, StripeNotConfiguredError } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.stripe_customer_id) {
      return NextResponse.redirect(new URL('/subscribe', process.env.NEXT_PUBLIC_APP_URL))
    }

    const url = await createPortalSession(profile.stripe_customer_id)
    if (!url) {
      return NextResponse.redirect(new URL('/profile?portal_error=1', process.env.NEXT_PUBLIC_APP_URL))
    }

    return NextResponse.redirect(url)

  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.redirect(new URL('/subscribe', process.env.NEXT_PUBLIC_APP_URL))
    }
    console.error('[stripe/portal]', err)
    return NextResponse.redirect(new URL('/profile?portal_error=1', process.env.NEXT_PUBLIC_APP_URL))
  }
}
