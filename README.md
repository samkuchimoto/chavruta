# Chavruta

Paired intellectual sessions. Two people, one text, 45 minutes. No teacher, no syllabus.

---

## Stack

- **Next.js 14** (App Router) — Vercel Hobby
- **Supabase** — database, auth, realtime (pgvector for embeddings)
- **Groq** — LLM matching + profile summarization *(optional — falls back to keyword matching)*
- **Nomic** — text embeddings *(optional — profiles save without a vector)*
- **Stripe** — €15/month subscription gate *(optional — core loop works without it)*
- **Gmail OAuth2** — transactional email *(optional — logs to console instead)*

---

## Deploy in order

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → paste and run `supabase/migrations/001_chavruta_schema.sql`
3. Authentication → URL Configuration → add your Vercel URL to **Redirect URLs**
4. Database → Replication → enable Realtime on `chavruta.messages` and `chavruta.sessions`
5. Copy from **Project Settings → API**: URL, anon key, service role key

### 2. Vercel

```bash
npm install
git init && git add . && git commit -m "init"
# push to GitHub, then import in Vercel dashboard
```

**Required env vars** (minimum to deploy):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

Everything else in `.env.example` is optional — add them one at a time as you wire up each service.

### 3. Seed source texts

In Supabase Table Editor → `chavruta.source_texts`, add 20–30 texts manually before launch. The system needs at least one row to assign a text to a session.

Columns: `title`, `body_or_link`, `topic_tag`

---

## Optional services (add when ready)

### Groq (better matching)
```
GROQ_API_KEY=
```
Get key at [console.groq.com](https://console.groq.com). Without it, matching uses keyword overlap — works, just coarser.

### Nomic (embeddings)
```
NOMIC_API_KEY=
```
Get key at [atlas.nomic.ai](https://atlas.nomic.ai). Without it, profiles save without a vector — matching still works via the Groq or keyword path.

### Stripe (payments)
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```
1. Create a product in Stripe dashboard: Recurring, €15/month
2. Copy the Price ID to `STRIPE_PRICE_ID`
3. Add webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
4. Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Without Stripe: the subscription gate is skipped and all users can match freely — useful for beta.

### Gmail (email notifications)
```
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_FROM_ADDRESS=
```
1. [console.cloud.google.com](https://console.cloud.google.com) → New project → Enable Gmail API
2. OAuth consent screen → External → add your Gmail as test user
3. Credentials → OAuth 2.0 Client ID → Desktop app
4. [OAuth Playground](https://developers.google.com/oauthplayground) with scope `https://mail.google.com/` → generate refresh token

Without Gmail: emails log to Vercel function logs instead of sending.

### Zadera (future — advanced matching)
```
ZADERA_API_KEY=
ZADERA_API_URL=
```
Fill in when the API contract is ready. The match route auto-switches to Zadera when both vars are set.

---

## Cron (session reminders + no-show detection)

Vercel Hobby supports cron at 1-hour granularity. `vercel.json` already configures it.

Set `CRON_SECRET` in Vercel env vars — any random string. Vercel injects it automatically into the cron request header.

---

## Architecture

```
lib/ports/          — interfaces (what the domain needs)
lib/adapters/       — implementations (real + null)
lib/container.ts    — wires adapters based on config
lib/ai.ts           — shim → container.matching
lib/gmail.ts        — shim → container.email
lib/stripe.ts       — shim → container.payment
```

Adding a provider: write an adapter, add one line in `container.ts`. No route or page changes.

---

## Go live checklist

- [ ] Supabase migration run
- [ ] Realtime enabled on `messages` + `sessions`
- [ ] Redirect URL added in Supabase Auth
- [ ] Source texts seeded (≥1 row)
- [ ] Required env vars set in Vercel
- [ ] Vercel project deployed
- [ ] Test signup → profile → match request end to end
- [ ] Upgrade Vercel to Pro ($20/mo) the day the first paid subscriber signs up (Hobby is non-commercial by Vercel ToS)
