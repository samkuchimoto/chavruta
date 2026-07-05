/**
 * lib/container.ts
 *
 * Dependency injection container — the single place where adapters are
 * selected and wired together.
 *
 * Rules:
 *   1. Every adapter selection is based on config.ts capability flags.
 *   2. There is always a valid adapter — never undefined, never null.
 *   3. No route, page, or component imports from adapters directly.
 *      They import from lib/ai.ts, lib/gmail.ts, lib/stripe.ts (thin shims
 *      that delegate here) — so no call sites change when adapters swap.
 *   4. Module-level singletons are per-cold-start in serverless — correct
 *      behavior; no need for a class-based IoC container.
 *
 * Adding a new provider:
 *   1. Write a new adapter implementing the relevant port
 *   2. Add a capability flag to lib/config.ts
 *   3. Add one line here: `config.newProvider ? new NewAdapter() : ...`
 *   Nothing else changes.
 */

import { config } from '@/lib/config'

import type { MatchingPort } from '@/lib/ports/matching'
import type { EmailPort }    from '@/lib/ports/email'
import type { PaymentPort }  from '@/lib/ports/payment'

import { KeywordMatchingAdapter } from '@/lib/adapters/matching/keyword.adapter'
import { GroqMatchingAdapter }    from '@/lib/adapters/matching/groq.adapter'
import { NullEmailAdapter }       from '@/lib/adapters/email/null.adapter'
import { GmailEmailAdapter }      from '@/lib/adapters/email/gmail.adapter'
import { NullPaymentAdapter }     from '@/lib/adapters/payment/null.adapter'
import { StripePaymentAdapter }   from '@/lib/adapters/payment/stripe.adapter'

// ── Adapter selection ─────────────────────────────────────────────────────────

// Matching: Groq if configured, keyword-overlap otherwise
// GroqMatchingAdapter internally falls back to KeywordMatchingAdapter on error,
// so even with Groq configured but temporarily unreachable, matching works.
const matching: MatchingPort = config.groq
  ? new GroqMatchingAdapter()
  : new KeywordMatchingAdapter()

// Email: Gmail if configured, null (console.log) otherwise
const email: EmailPort = config.gmail
  ? new GmailEmailAdapter()
  : new NullEmailAdapter()

// Payment: Stripe if configured, null (graceful no-op) otherwise
const payment: PaymentPort = config.stripe
  ? new StripePaymentAdapter()
  : new NullPaymentAdapter()

// ── Container export ──────────────────────────────────────────────────────────
// One import path for all adapters. Call sites:
//   import { container } from '@/lib/container'
//   container.matching.findBestMatch(...)
//   container.email.sendMatchedEmail(...)
//   container.payment.createCheckoutSession(...)

export const container = {
  matching,
  email,
  payment,
} as const

export type Container = typeof container
