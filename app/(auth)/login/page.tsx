/**
 * app/(auth)/login/page.tsx
 *
 * Client Component — needs form state + Supabase browser client.
 * useSearchParams requires a Suspense boundary in Next.js 14;
 * the inner component handles the form, the default export wraps it.
 *
 * After login: pushes to redirectTo (set by middleware) or /match.
 * router.refresh() forces server components to re-render with the new session.
 */

'use client'

import { Suspense, useState }          from 'react'
import { useRouter, useSearchParams }  from 'next/navigation'
import Link                            from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'

// ── Error mapping ────────────────────────────────────────────────────────────

function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Wrong email or password.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email before logging in. Check your inbox.'
  }
  if (message.includes('Too many requests')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  return 'Something went wrong. Try again.'
}

// ── Inner form (uses useSearchParams — must be inside Suspense) ──────────────

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirectTo') ?? '/match'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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

    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (authError) {
      setError(mapAuthError(authError.message))
      setLoading(false)
      return
    }

    // refresh() re-runs Server Components so they pick up the new session cookie
    router.push(redirectTo)
    router.refresh()
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
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Sign in to continue to your sessions.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input"
            disabled={loading}
          />
          {/* Password reset: out of scope for v1 — add /reset-password route when needed */}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 text-sm"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading || !email || !password}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Switch to signup */}
      <p className="text-sm mt-6 text-center" style={{ color: 'var(--color-muted)' }}>
        No account?{' '}
        <Link
          href="/signup"
          style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
        >
          Sign up
        </Link>
      </p>

    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────
// Suspense boundary required by Next.js 14 when useSearchParams
// is used inside a Client Component subtree.

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
