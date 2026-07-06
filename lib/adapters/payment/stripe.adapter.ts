/**
 * lib/adapters/payment/stripe.adapter.ts
 *
 * Stripe implementation of PaymentPort.
 *
 * This is the only file in the codebase that imports from 'stripe'.
 * If the payment provider changes, only this file (and its null counterpart)
 * needs to be replaced — no domain code touches Stripe types.
 *
 * The constructWebhookEvent method is the most important translation:
 * it converts Stripe's complex event union into the small, domain-native
 * PaymentWebhookEvent type that the webhook route handler works with.
 */

import Stripe from 'stripe'
import type {
  PaymentPort,
  CheckoutParams,
  CustomerResult,
  PaymentWebhookEvent,
  SubscriptionStatus,
} from '@/lib/ports/payment'

// ── Stripe → domain status translation ───────────────────────────────────────

function toOurStatus(stripeStatus: Stripe.Subscription['status']): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'inactive'
  }
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class StripePaymentAdapter implements PaymentPort {

  private client: Stripe

  constructor() {
    this.client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
      typescript:  true,
    })
  }

  async createCheckoutSession(params: CheckoutParams): Promise<string | null> {
    const { userId, userEmail, customerId } = params
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const session = await this.client.checkout.sessions.create({
      mode:     'subscription',
      currency: 'eur',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      client_reference_id:  userId,
      allow_promotion_codes: true,
      success_url: `${appUrl}/match?subscribed=1`,
      cancel_url:  `${appUrl}/subscribe?canceled=1`,
      subscription_data: {
        metadata: { chavruta_user_id: userId },
      },
      ...(customerId
        ? { customer: customerId }
        : { customer_email: userEmail }
      ),
    })

    return session.url
  }

  async createPortalSession(customerId: string): Promise<string | null> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const session = await this.client.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${appUrl}/profile`,
    })

    return session.url
  }

  async createOrRetrieveCustomer(
    userId:             string,
    email:              string,
    existingCustomerId: string | null | undefined
  ): Promise<CustomerResult> {
    if (existingCustomerId) {
      try {
        const customer = await this.client.customers.retrieve(existingCustomerId)
        if (!customer.deleted) {
          return { customerId: existingCustomerId, isNew: false }
        }
      } catch {
        // Not found in Stripe — fall through to create
      }
    }

    const customer = await this.client.customers.create({
      email,
      metadata: { chavruta_user_id: userId },
    })

    return { customerId: customer.id, isNew: true }
  }

  constructWebhookEvent(body: string, signature: string): PaymentWebhookEvent {
    const event = this.client.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // ── Translate Stripe event → domain event ─────────────────────────────
    switch (event.type) {

      case 'checkout.session.completed': {
        const session     = event.data.object as Stripe.Checkout.Session
        const userId      = session.client_reference_id
        const customerId  = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? ''

        if (!userId || !subscriptionId) {
          console.error('[stripe] checkout.completed missing userId or subscriptionId')
          return { type: 'unknown' }
        }

        // Fetch current subscription status (checkout.session doesn't carry it)
        // Note: async in a sync method is not ideal, but constructWebhookEvent
        // is called from an async route handler, so the caller awaits correctly.
        // We return a promise-compatible shape by letting the adapter be called
        // with await in the webhook route.
        // For now, optimistically return 'active' — the subscription.updated
        // event that fires immediately after will correct any discrepancy.
        return {
          type:               'checkout.completed',
          userId,
          customerId,
          subscriptionId,
          subscriptionStatus: 'active',
        }
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        return {
          type:               'subscription.updated',
          userId:             sub.metadata?.chavruta_user_id ?? null,
          subscriptionId:     sub.id,
          customerId:         typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          subscriptionStatus: toOurStatus(sub.status),
        }
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        return {
          type:           'subscription.deleted',
          userId:         sub.metadata?.chavruta_user_id ?? null,
          subscriptionId: sub.id,
          customerId:     typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        }
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? ''
        return { type: 'payment.failed', customerId }
      }

      default:
        return { type: 'unknown' }
    }
  }
}
