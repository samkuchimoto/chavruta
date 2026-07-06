/**
 * app/api/stripe/webhook/route.ts
 *
 * POST /api/stripe/webhook
 *
 * The webhook handler works with domain-native PaymentWebhookEvent types —
 * no Stripe imports needed here. The adapter (stripe.adapter.ts) translates.
 *
 * Returns 503 (not 400) when Stripe is not configured, so Stripe can
 * distinguish "endpoint doesn't exist" from "endpoint exists but unconfigured."
 */

import { NextRequest, NextResponse }             from 'next/server'
import { supabaseAdmin }                         from '@/lib/supabase'
import { constructWebhookEvent, StripeNotConfiguredError } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: ReturnType<typeof constructWebhookEvent>
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 })
    }
    console.error('[stripe/webhook] signature invalid:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.completed':
        await supabaseAdmin
          .from('profiles')
          .update({
            stripe_customer_id:     event.customerId,
            stripe_subscription_id: event.subscriptionId,
            subscription_status:    event.subscriptionStatus,
          })
          .eq('id', event.userId)
        break

      case 'subscription.updated':
        if (event.userId) {
          await supabaseAdmin
            .from('profiles')
            .update({ subscription_status: event.subscriptionStatus })
            .eq('id', event.userId)
        } else {
          await supabaseAdmin
            .from('profiles')
            .update({ subscription_status: event.subscriptionStatus })
            .eq('stripe_subscription_id', event.subscriptionId)
        }
        break

      case 'subscription.deleted':
        if (event.userId) {
          await supabaseAdmin
            .from('profiles')
            .update({ subscription_status: 'canceled' })
            .eq('id', event.userId)
        } else {
          await supabaseAdmin
            .from('profiles')
            .update({ subscription_status: 'canceled' })
            .eq('stripe_subscription_id', event.subscriptionId)
        }
        break

      case 'payment.failed':
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', event.customerId)
        break

      case 'unknown':
        // Unhandled Stripe event type — normal, just acknowledge
        break
    }
  } catch (err) {
    console.error(`[stripe/webhook] handler failed for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
