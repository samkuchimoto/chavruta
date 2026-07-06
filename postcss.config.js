/**
 * postcss.config.js
 *
 * Tailwind v4 collapses the old tailwindcss + autoprefixer pair
 * into a single @tailwindcss/postcss plugin.
 * Theme configuration moves to globals.css via @theme — no tailwind.config.ts needed.
 */

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
