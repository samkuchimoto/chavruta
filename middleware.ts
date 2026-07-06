/**
 * middleware.ts
 *
 * Two jobs:
 *   1. Refresh the Supabase auth session on every matched request.
 *   2. Enforce route-level auth: redirect unauthenticated users away from
 *      protected pages, redirect authenticated users away from auth pages.
 *
 * Resilience: if Supabase isn't configured at all (NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY missing — common right after a fresh Vercel
 * deploy, before secrets are added), middleware runs on EVERY request, so a
 * naive client construction here would take down the entire site, including
 * the public landing page. Instead, middleware short-circuits to a plain
 * pass-through in that case: the skeleton (landing page, static content)
 * stays reachable. Protected pages will still fail individually when they
 * try to query Supabase — a contained, page-level error instead of a
 * site-wide one.
 *
 * Subscription gating (match requires active sub) is NOT done here.
 * It lives in /api/match, keeping middleware thin.
 *
 * Note on naming: Next.js requires the matcher object below to be exported
 * as `config`. lib/config.ts also exports something named `config`. To avoid
 * the collision, lib/config's export is imported here under the alias
 * `appConfig` rather than working around it with re-export gymnastics.
 */

import { createServerClient }     from '@supabase/ssr'
import type { CookieOptions }     from '@supabase/ssr'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'
import type { Database }          from '@/lib/supabase'
import { config as appConfig }    from '@/lib/config'

const PROTECTED = [
  '/profile',
  '/match',
  '/sessions',
  '/feedback',
  '/subscribe',
]

const AUTH_PAGES = ['/login', '/signup']

function isProtected(pathname: string): boolean {
  return PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// ── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Supabase not configured — pass everything through ────────────────────
  // Lets the bare skeleton deploy and render before secrets are added.
  if (!appConfig.supabase) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'chavruta' },
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (pathname.startsWith('/api/')) {
    return response
  }

  if (!user && isProtected(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/match', request.url))
  }

  return response
}

// ── Matcher ──────────────────────────────────────────────────────────────────
// Next.js looks for this exact export name. Runs middleware on all paths
// except built assets, favicon, the Stripe webhook (needs raw body; signature
// is its own auth), and cron routes (protected by CRON_SECRET, not a cookie).

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/stripe/webhook|api/cron).*)',
  ],
}
