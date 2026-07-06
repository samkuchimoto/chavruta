/**
 * lib/adapters/payment/null.adapter.ts
 *
 * Null payment adapter — used when Stripe is not configured.
 *
 * In demo mode:
 *   createCheckoutSession → returns null (caller shows "payments not configured")
 *   createPortalSession   → returns null
 *   createOrRetrieveCustomer → throws (checkout flow can't proceed without it,
 *                              and this path should never be reached in demo mode
 *                              since the checkout route checks config.stripe first)
 *   constructWebhookEvent → throws with a clear message (webhook route
 *                           should never be called if Stripe isn't configured)
 *
 * Critically: the /api/match subscription gate checks config.stripe and
 * SKIPS the gate in demo mode. So users can match and session without Stripe.
 * The null adapter just prevents crashes if something wires up wrong.
 */

import type {
  PaymentPort,
  CheckoutParams,
  CustomerResult,
  PaymentWebhookEvent,
} from '@/lib/ports/payment'

export class NullPaymentAdapter implements PaymentPort {

  async createCheckoutSession(_params: CheckoutParams): Promise<string | null> {
    console.log('[payment:null] createCheckoutSession — Stripe not configured')
    return null
  }

  async createPortalSession(_customerId: string): Promise<string | null> {
    console.log('[payment:null] createPortalSession — Stripe not configured')
    return null
  }

  async createOrRetrieveCustomer(
    _userId:    string,
    _email:     string,
    _existing?: string | null
  ): Promise<CustomerResult> {
    throw new Error(
      '[payment:null] createOrRetrieveCustomer called but Stripe is not configured. ' +
      'Check STRIPE_SECRET_KEY and STRIPE_PRICE_ID.'
    )
  }

  constructWebhookEvent(
    _body:      string,
    _signature: string
  ): PaymentWebhookEvent {
    throw new Error(
      '[payment:null] constructWebhookEvent called but Stripe is not configured. ' +
      'This endpoint should not receive webhook traffic if Stripe is not set up.'
    )
  }
}
