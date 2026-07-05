/**
 * app/(auth)/signup/page.tsx
 *
 * Two-step onboarding:
 *   Step 1 (here)       — display name, email, password → creates auth.users row
 *   Step 2 (/profile)   — what_i_know, what_i_want → creates chavruta.profiles row
 *
 * After signUp(), Supabase sends a confirmation email.
 * emailRedirectTo points to /profile so users land on the profile form
 * immediately after confirming — no extra navigation step.
 *
 * Supabase dashboard setting to check:
 *   Auth → URL Configuration → add https://yourdomain.com/profile to "Redirect URLs"
 *   Auth → Email Templates — you can customise the confirmation email copy here.
 *   Auth → Providers → Email → "Confirm email" toggle (on by default, keep it on)
 */

'use client'

import { useState }                    from 'react'
import Link                            from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'

// ── Error mapping ────────────────────────────────────────────────────────────

function mapSignupError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists.'
  }
  if (message.includes('Password should be')) {
    return 'Password must be at least 8 characters.'
  }
  if (message.includes('Unable to validate email')) {
    return 'Please enter a valid email address.'
  }
  if (message.includes('Too many requests')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return 'Something went wrong. Try again.'
}

// ── Success state ─────────────────────────────────────────────────────────────

function ConfirmationSent({ email }: { email: string }) {
  return (
    <div className="narrow-shell animate-fade-in">

      <div className="mb-10">
        <Link href="/" className="wordmark">Chavruta</Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl mb-4" style={{ letterSpacing: '-0.01em' }}>
          Check your email.
        </h1>
        <p className="text-sm mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
          We sent a confirmation link to{' '}
          <span style={{ color: 'var(--color-foreground)' }}>{email}</span>.
        </p>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Click it to activate your account. You'll land on your profile page
          where you'll describe what you know and what you want to think about.
        </p>
      </div>

      <div
        className="card"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <p
          className="text-sm"
          style={{
            color:      'var(--color-muted)',
            fontStyle:  'italic',
            fontFamily: 'var(--font-serif)',
            fontSize:   '1rem',
            lineHeight: '1.7',
          }}
        >
          The matching only works if you're honest in your profile.
          Write what you actually know, not what sounds impressive.
          Write what you actually want to think about, not what seems acceptable.
        </p>
      </div>

      <p className="text-sm mt-8 text-center" style={{ color: 'var(--color-muted)' }}>
        Wrong email?{' '}
        <Link
          href="/signup"
          onClick={() => window.location.reload()}
          style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
        >
          Start over
        </Link>
      </p>

    </div>
  )
}

// ── Signup form ───────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [done,        setDone]        = useState(false)

  // Client-side password length check (Supabase minimum is 6; we want 8)
  const passwordTooShort = password.length > 0 && password.length < 8
  const canSubmit = displayName.trim() && email.trim() && password.length >= 8 && !loading

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError(null)

    let supabase
    try {
      supabase = createBrowserSupabaseClient()
    } catch {
      setError('Authentication is not configured. Add Supabase credentials to your environment.')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
        // After email confirmation, land directly on the profile form
        emailRedirectTo: `${window.location.origin}/profile`,
      },
    })

    if (authError) {
      setError(mapSignupError(authError.message))
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return <ConfirmationSent email={email} />
  }

  return (
    <div className="narrow-shell animate-fade-in">

      {/* Wordmark */}
      <div className="mb-10">
        <Link href="/" className="wordmark">Chavruta</Link>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl mb-2" style={{ letterSpacing: '-0.01em' }}>
          Create your account
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          You'll describe your knowledge after confirming your email.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>

        {/* Display name */}
        <div className="mb-5">
          <label htmlFor="displayName" className="label">
            Your name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            autoFocus
            required
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="How you'll appear to your chavruta"
            className="input"
            disabled={loading}
            maxLength={60}
          />
        </div>

        {/* Email */}
        <div className="mb-5">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            disabled={loading}
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="input"
            disabled={loading}
          />
          {passwordTooShort && (
            <p
              className="text-xs mt-1.5"
              style={{ color: 'var(--color-muted)' }}
            >
              {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} needed
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 text-sm"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            {error}
            {error.includes('already exists') && (
              <>
                {' '}
                <Link
                  href="/login"
                  style={{ textDecoration: 'underline', color: 'var(--color-accent)' }}
                >
                  Log in instead →
                </Link>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={!canSubmit}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {/* Switch to login */}
      <p className="text-sm mt-6 text-center" style={{ color: 'var(--color-muted)' }}>
        Already have an account?{' '}
        <Link
          href="/login"
          style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
        >
          Log in
        </Link>
      </p>

    </div>
  )
}
