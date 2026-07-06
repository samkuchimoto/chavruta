/**
 * app/(app)/loading.tsx
 *
 * Next.js App Router shows this component as a Suspense fallback while any
 * Server Component inside the (app) route group is fetching data.
 * Covers: /profile, /match, /sessions, /sessions/[id], /feedback/[id], /subscribe.
 *
 * Kept deliberately minimal — a single pulsing wordmark.
 * A skeleton that tries to match the target layout often causes jarring
 * layout shifts when the real content arrives. A neutral placeholder
 * that fades out is less disruptive.
 */

export default function AppLoading() {
  return (
    <div
      style={{
        minHeight:      '100dvh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <span
        className="wordmark animate-pulse-subtle"
        style={{ opacity: 0.4 }}
      >
        Chavruta
      </span>
    </div>
  )
}
