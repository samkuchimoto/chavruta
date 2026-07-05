/**
 * app/layout.tsx
 *
 * Fonts via next/font/google — self-hosted by Next.js at build time.
 * Vercel fetches them from Google once during `next build` and serves
 * them from your own domain. No user IP sent to Google at runtime.
 *
 * If you need to build in an environment without internet access
 * (CI runners, restricted networks), switch to next/font/local with
 * manually downloaded woff2 files in /public/fonts/.
 *
 * CSS variables --font-inter and --font-crimson-pro are consumed by
 * globals.css @theme as --font-sans and --font-serif respectively.
 */

import type { Metadata, Viewport } from 'next'
import { Inter, Crimson_Pro }      from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
})

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  weight:  ['400', '600'],
  style:   ['normal', 'italic'],
  variable: '--font-crimson-pro',
  display:  'swap',
})

export const metadata: Metadata = {
  title: {
    default:  'Chavruta',
    template: '%s — Chavruta',
  },
  description:
    'Paired intellectual sessions. Two people, one text, 45 minutes. ' +
    'No teacher, no syllabus — just the question that moves between you.',
  keywords: ['paired learning', 'intellectual discussion', 'chavruta', 'reading sessions'],
  authors:  [{ name: 'Chavruta' }],
  robots:   { index: true, follow: true },
  openGraph: {
    type:        'website',
    siteName:    'Chavruta',
    title:       'Chavruta',
    description: 'Paired intellectual sessions. Two people, one text, 45 minutes.',
  },
}

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#09090B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${crimsonPro.variable}`}>
      <body>{children}</body>
    </html>
  )
}
