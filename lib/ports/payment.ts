/**
 * lib/ports/payment.ts
 *
 * Payment port — the domain's contract for subscription management.
 *
 * Zero imports from Stripe, Paddle, LemonSqueezy, or any payment provider.
 * The webhook event type is defined in domain terms (what WE care about),
 * not in Stripe's terms — the adapter translates between the two.
 *
 * This is the most important decoupling in the codebase. Payment providers
 * have APIs that change, fee structures that change, and availability that
 * varies. The domain never knows which one it's using.
 */

export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due'

export type CustomerResult = {
  customerId: string
  isNew:      boolean
}

export type CheckoutParams = {
  userId:        string
  userEmail:     string
  customerId?:   string | null
}

// ── Domain-native webhook event ───────────────────────────────────────────────
// The adapter is responsible for parsing raw provider payloads into these.
// The webhook route handler switches on `type` without ever touching
// Stripe.Event, Paddle.Event, or any provider type.

export type PaymentWebhookEvent =
  | {
      type:               'checkout.completed'
      userId:             string
      customerId:         string
      subscriptionId:     string
      subscriptionStatus: SubscriptionStatus
    }
  | {
      type:               'subscription.updated'
      userId:             string | null    // may be null if metadata is missing
      subscriptionId:     string
      customerId:         string
      subscriptionStatus: SubscriptionStatus
    }
  | {
      type:          'subscription.deleted'
      userId:        string | null
      subscriptionId: string
      customerId:    string
    }
  | {
      type:       'payment.failed'
      customerId: string
    }
  | {
      type: 'unknown'
    }

// ── Port interface ───────────────────────────────────────────────────────────

export interface PaymentPort {
  /**
   * Creates a Checkout session and returns the redirect URL.
   * Returns null (never throws) if the payment provider is unavailable.
   */
  createCheckoutSession(params: CheckoutParams): Promise<string | null>

  /**
   * Creates a Customer Portal session and returns the redirect URL.
   * Returns null if unconfigured or unavailable.
   */
  createPortalSession(customerId: string): Promise<string | null>

  /**
   * Returns an existing customer ID or creates a new one.
   * Throws on hard failure — checkout can't proceed without a customer.
   */
  createOrRetrieveCustomer(
    userId:             string,
    email:              string,
    existingCustomerId: string | null | undefined
  ): Promise<CustomerResult>

  /**
   * Verifies the raw webhook body + provider signature and returns a
   * domain-native event. Throws if the signature is invalid — the webhook
   * route should return 400 in that case to trigger provider retry.
   */
  constructWebhookEvent(
    body:      string,
    signature: string
  ): PaymentWebhookEvent
}
