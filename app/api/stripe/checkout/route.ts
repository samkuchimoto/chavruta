/**
 * app/api/stripe/checkout/route.ts
 *
 * POST /api/stripe/checkout
 * Returns { url } — client redirects to Stripe Checkout.
 * Returns 503 with { error: 'payments_not_configured' } in demo mode.
 */

import { NextResponse }                              from 'next/server'
import { createServerSupabaseClient }                from '@/lib/supabase'
import { createOrRetrieveCustomer, createCheckoutSession, StripeNotConfiguredError } from '@/lib/stripe'

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'profile_incomplete' }, { status: 400 })
    }

    if (profile.subscription_status === 'active') {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
    }

    if (!user.email) {
      return NextResponse.json({ error: 'No email on account.' }, { status: 400 })
    }

    const { customerId, isNew } = await createOrRetrieveCustomer(
      user.id,
      user.email,
      profile.stripe_customer_id
    )

    if (isNew) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const url = await createCheckoutSession({ userId: user.id, userEmail: user.email, customerId })
    return NextResponse.json({ url })

  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
    }
    console.error('[stripe/checkout]', err)
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
  }
}
