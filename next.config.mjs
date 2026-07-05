/**
 * next.config.mjs
 *
 * next.config.ts is only supported from Next.js 15+.
 * Next.js 14.2 requires .js or .mjs.
 */

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    serverComponentsExternalPackages: ['nodemailer', 'stripe'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default config
