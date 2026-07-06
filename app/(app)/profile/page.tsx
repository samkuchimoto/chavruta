/**
 * app/(app)/profile/page.tsx
 *
 * Two states:
 *   isNew = true  — no profile row yet; user just confirmed their email
 *   isNew = false — existing profile; show current values + subscription status
 *
 * Server Action (upsertProfile):
 *   1. Validate fields
 *   2. Generate summary via Groq (generateProfileSummary)
 *   3. Embed summary via Nomic (embed) — fails gracefully; profile saves without embedding
 *   4. Upsert chavruta.profiles
 *   5. Redirect to /match on success
 *
 * Authenticated client used for upsert — RLS allows users to write their own row.
 * Admin client used nowhere here; the user's session is sufficient.
 */

import { redirect }                   from 'next/navigation'
import Link                           from 'next/link'
import type { Metadata }              from 'next'
import { createServerSupabaseClient } from '@/lib/supabase'
import { generateProfileSummary, embed } from '@/lib/ai'
import {
  ProfileForm,
  type ProfileFormState,
}                                     from './ProfileForm'

export const metadata: Metadata = { title: 'Profile' }

// ── Server Action ─────────────────────────────────────────────────────────────

async function upsertProfile(
  _state:   ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  'use server'

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName = (formData.get('display_name') as string | null)?.trim() ?? ''
  const whatIKnow   = (formData.get('what_i_know')  as string | null)?.trim() ?? ''
  const whatIWant   = (formData.get('what_i_want')  as string | null)?.trim() ?? ''

  // Validate
  if (!displayName) return { error: 'Name is required.' }
  if (whatIKnow.length < 40) return { error: 'Tell us a bit more about what you know (at least 40 characters).' }
  if (whatIWant.length < 40) return { error: 'Tell us a bit more about what you want to think about (at least 40 characters).' }

  // Generate embedding — fail gracefully so profile saves even if Nomic is down
  let embedding: number[] | null = null
  try {
    const summary = await generateProfileSummary(whatIKnow, whatIWant)
    embedding = await embed(summary)
  } catch (err) {
    console.error('[profile] Embedding failed, saving without vector:', err)
  }

  // Upsert — onConflict on id means insert becomes update if row exists
  const { error: dbError } = await supabase
    .from('profiles')
    .upsert(
      {
        id:           user.id,
        display_name: displayName,
        what_i_know:  whatIKnow,
        what_i_want:  whatIWant,
        ...(embedding ? { embedding } : {}),
      },
      { onConflict: 'id' }
    )

  if (dbError) {
    console.error('[profile] Upsert failed:', dbError)
    return { error: 'Could not save your profile. Try again.' }
  }

  redirect('/match')
}

// ── Subscription status display ───────────────────────────────────────────────

function SubscriptionSection({
  status,
  customerId,
}: {
  status:     string
  customerId: string | null
}) {
  const statusMap: Record<string, { label: string; className: string }> = {
    active:   { label: 'Active',        className: 'badge badge-active'  },
    past_due: { label: 'Payment issue', className: 'badge badge-error'   },
    canceled: { label: 'Canceled',      className: 'badge badge-pending' },
    inactive: { label: 'No subscription', className: 'badge badge-pending' },
  }

  const display = statusMap[status] ?? statusMap.inactive

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          flexWrap:       'wrap',
          gap:            '0.75rem',
        }}
      >
        <div>
          <p className="label mb-1">Subscription</p>
          <span className={display.className}>{display.label}</span>
        </div>

        <div>
          {status === 'active' && customerId ? (
            <Link href="/api/stripe/portal" className="btn btn-outline" style={{ fontSize: 'var(--text-xs)' }}>
              Manage →
            </Link>
          ) : status === 'past_due' && customerId ? (
            <Link href="/api/stripe/portal" className="btn btn-destructive" style={{ fontSize: 'var(--text-xs)' }}>
              Resolve payment →
            </Link>
          ) : (
            <Link href="/subscribe" className="btn btn-outline" style={{ fontSize: 'var(--text-xs)' }}>
              Subscribe — €15/month →
            </Link>
          )}
        </div>
      </div>

      {status === 'active' && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
          Active subscription lets you request new matches.
          You can cancel any time from the billing portal.
        </p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProfilePage() {
  const supabase = createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile — null means new user
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, what_i_know, what_i_want, subscription_status, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  const isNew = !profile

  // Default display_name from Supabase auth metadata (set at signup)
  const metaName = (user.user_metadata?.display_name as string | undefined) ?? ''

  const defaults = {
    displayName: profile?.display_name ?? metaName,
    whatIKnow:   profile?.what_i_know  ?? '',
    whatIWant:   profile?.what_i_want  ?? '',
  }

  return (
    <div className="page-shell pt-fluid">
      <div className="prose-shell animate-fade-in">

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
            {isNew ? 'Tell us about yourself.' : 'Your profile'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {isNew
              ? 'This is how we find your chavruta. Take your time.'
              : 'Changes here affect who you match with next, not your current session.'
            }
          </p>
        </div>

        {/* Profile form */}
        <ProfileForm
          action={upsertProfile}
          defaults={defaults}
          isNew={isNew}
        />

        {/* Subscription — only shown for existing profiles */}
        {!isNew && (
          <SubscriptionSection
            status={profile.subscription_status}
            customerId={profile.stripe_customer_id}
          />
        )}

      </div>
    </div>
  )
}
