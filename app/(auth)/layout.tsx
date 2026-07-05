/**
 * app/(auth)/layout.tsx
 *
 * Shared shell for /login and /signup.
 * Positions content slightly above vertical center — the natural resting
 * point for a form that's taller than it is wide.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="page-shell"
      style={{
        justifyContent: 'flex-start',
        paddingTop:     'clamp(4rem, 12vh, 7rem)',
      }}
    >
      {children}
    </div>
  )
}
