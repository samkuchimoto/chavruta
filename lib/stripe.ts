/**
 * lib/stripe.ts — public shim for payment operations
 *
 * Delegates entirely to container.payment.
 * All existing imports (`import { createCheckoutSession } from '@/lib/stripe'`)
 * continue to work. Real vs. null adapter is determined by the container.
 *
 * StripeNotConfiguredError is kept here as a typed sentinel that route handlers
 * can catch without importing from the adapter directly.
 */

import { container } from '@/lib/container'
import { config }    from '@/lib/config'

// Re-export types so call sites can import them from '@/lib/stripe' as before
export type {
  SubscriptionStatus as SubscriptionEventStatus,
  CheckoutParams     as CheckoutSessionParams,
  CustomerResult,
  PaymentWebhookEvent,
} from '@/lib/ports/payment'

// ── Typed sentinel — caught by checkout/webhook/portal routes ────────────────
export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_ID missing).')
    this.name = 'StripeNotConfiguredError'
  }
}

// ── Shim functions ───────────────────────────────────────────────────────────

export async function createCheckoutSession(
  params: Parameters<typeof container.payment.createCheckoutSession>[0]
): Promise<string | null> {
  if (!config.stripe) throw new StripeNotConfiguredError()
  return container.payment.createCheckoutSession(params)
}

export async function createPortalSession(customerId: string): Promise<string | null> {
  if (!config.stripe) throw new StripeNotConfiguredError()
  return container.payment.createPortalSession(customerId)
}

export async function createOrRetrieveCustomer(
  userId:   string,
  email:    string,
  existing: string | null | undefined
): Promise<import('@/lib/ports/payment').CustomerResult> {
  if (!config.stripe) throw new StripeNotConfiguredError()
  return container.payment.createOrRetrieveCustomer(userId, email, existing)
}

export function constructWebhookEvent(
  body:      string,
  signature: string
): import('@/lib/ports/payment').PaymentWebhookEvent {
  if (!config.stripe || !config.stripeWebhook) throw new StripeNotConfiguredError()
  return container.payment.constructWebhookEvent(body, signature)
}
