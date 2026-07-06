/**
 * app/page.tsx
 *
 * Landing page — visible to everyone, authenticated or not.
 * Server Component: no client-side JS, no data fetching.
 *
 * Tone: honest about what the product is. No promises beyond the mechanism.
 * Content guardrail: nothing about pain, health, or therapy anywhere here.
 */

import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chavruta — Paired intellectual sessions',
}

export default function LandingPage() {
  return (
    <div className="page-shell pt-fluid">

      {/* ── Top bar ── */}
      <header className="prose-shell flex items-center justify-between mb-20">
        <span className="wordmark">Chavruta</span>
        <Link href="/login" className="btn btn-ghost text-xs tracking-wide">
          Log in
        </Link>
      </header>

      {/* ── Hero ── */}
      <main className="prose-shell animate-fade-in">

        <div className="mb-16">
          <h1
            className="text-3xl mb-6 text-balance"
            style={{ lineHeight: '1.3', letterSpacing: '-0.01em' }}
          >
            Two people.
            <br />
            One text.
            <br />
            <span style={{ color: 'var(--color-muted)' }}>45 minutes.</span>
          </h1>

          <p className="text-base mb-4" style={{ color: 'var(--color-muted-foreground)', maxWidth: '520px' }}>
            You describe what you know and what you want to think about.
            We find someone whose knowledge fills your gap — and whose gap you fill.
          </p>

          <p className="text-base" style={{ color: 'var(--color-muted)', maxWidth: '520px' }}>
            You get a shared text and a 45-minute session.
            No teacher. No agenda. Just the question that moves between you.
          </p>
        </div>

        {/* ── CTAs ── */}
        <div className="flex items-center gap-4 mb-24">
          <Link href="/signup" className="btn btn-primary">
            Get started
          </Link>
          <Link
            href="/login"
            className="text-sm"
            style={{ color: 'var(--color-muted)' }}
          >
            Already have an account →
          </Link>
        </div>

        {/* ── Mechanism ── */}
        <div
          className="mb-24"
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '3rem',
          }}
        >
          <p className="label mb-8">How it works</p>

          <ol className="space-y-8" style={{ listStyle: 'none', padding: 0 }}>
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-6">
                <span
                  className="text-sm shrink-0 mt-0.5 tabular-nums"
                  style={{ color: 'var(--color-accent)', width: '1.25rem' }}
                >
                  {i + 1}
                </span>
                <div>
                  <p
                    className="text-sm mb-1"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {step.heading}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Origin note ── */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '2rem',
          }}
        >
          <p
            className="text-sm"
            style={{
              color:       'var(--color-muted)',
              fontStyle:   'italic',
              fontFamily:  'var(--font-serif)',
              fontSize:    '1.0625rem',
              lineHeight:  '1.7',
              maxWidth:    '480px',
            }}
          >
            Chavruta is the Aramaic word for companionship. In the Jewish study tradition,
            two people sit with the same text — neither as teacher — and the question
            moves between them. The rabbis understood: isolated learning is not learning at all.
          </p>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer
        className="prose-shell mt-auto pt-16 pb-4"
        style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}
      >
        <p>© {new Date().getFullYear()} Chavruta</p>
      </footer>

    </div>
  )
}

// ── Step content ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    heading: 'Describe what you bring and what you want.',
    body: 'In your own words — no dropdowns, no tags. What do you know deeply, and what territory do you want to think inside?',
  },
  {
    heading: 'Get matched with a complementary mind.',
    body: "Not someone similar — someone whose knowledge fills your gap, and whose gap your knowledge fills. Different backgrounds, same intellectual territory.",
  },
  {
    heading: 'Meet around a shared text for 45 minutes.',
    body: 'A primary source, a problem, a document. The timer starts with your first message. No preparation required.',
  },
  {
    heading: 'Say what emerged. Request your next match.',
    body: 'Two questions after the session. Your answers shape who you meet next.',
  },
]
