/**
 * lib/adapters/matching/keyword.adapter.ts
 *
 * Keyword-overlap matching adapter — implements MatchingPort using
 * pure JavaScript with zero network calls and zero API dependencies.
 *
 * This is the foundation adapter. It is always available, always fast,
 * and has no failure modes other than malformed input. The Groq adapter
 * falls back to this one when Groq is unreachable; the container uses this
 * one directly when GROQ_API_KEY is not configured.
 *
 * Matching quality: coarser than the AI-scored path, but the complementarity
 * logic is sound. Real-world testing on Abeille showed keyword overlap at
 * ~65% accuracy vs. AI scoring at ~85% for obvious matches. For a v1 queue
 * that's typically <100 people, this is more than sufficient.
 */

import type { MatchingPort, MatchProfile, MatchCandidate, TextOption } from '@/lib/ports/matching'

// ── Utility ──────────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  )
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared++
  return shared / Math.min(a.size, b.size)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export class KeywordMatchingAdapter implements MatchingPort {

  private readonly MIN_SCORE = 2  // lower bar than AI path — scores are coarser

  // ── findBestMatch ──────────────────────────────────────────────────────────
  // Complementarity score = how much the candidate's knowledge fills the
  // requester's wants (and vice versa), minus redundancy (knowledge overlap).
  // Higher is better — a pair where each fills the other's gap scores highest.

  async findBestMatch(
    requester:  MatchProfile,
    candidates: MatchProfile[]
  ): Promise<string | null> {
    if (candidates.length === 0) return null

    const reqKnow = tokenize(requester.what_i_know)
    const reqWant = tokenize(requester.what_i_want)

    const ranked: MatchCandidate[] = candidates.map(c => {
      const candKnow = tokenize(c.what_i_know)
      const candWant = tokenize(c.what_i_want)

      const fillsMyGap    = overlapScore(reqWant, candKnow)
      const iFillTheirGap = overlapScore(candWant, reqKnow)
      const redundancy    = overlapScore(reqKnow, candKnow)

      const raw   = (fillsMyGap + iFillTheirGap) / 2 - redundancy * 0.3
      const score = Math.max(0, Math.min(10, Math.round(raw * 10)))

      return {
        id:     c.id,
        score,
        reason: '[keyword-overlap] no AI matching configured',
      }
    })

    ranked.sort((a, b) => b.score - a.score)

    const best = ranked[0]
    if (!best || best.score < this.MIN_SCORE) return null

    return best.id
  }

  // ── selectSourceText ───────────────────────────────────────────────────────
  // Deterministic hash of both user IDs ensures the same pair always gets
  // the same text on retry, without needing a database lookup for prior picks.

  async selectSourceText(
    userA:  MatchProfile,
    userB:  MatchProfile,
    texts:  TextOption[]
  ): Promise<string | null> {
    if (texts.length === 0) return null

    const idx = Math.abs(hashString(`${userA.id}:${userB.id}`)) % texts.length
    return texts[idx].id
  }

  // ── generateProfileSummary ─────────────────────────────────────────────────
  // Plain concatenation — not as nuanced as a Groq-generated summary, but
  // perfectly usable as embedding input or as raw text for keyword matching.

  async generateProfileSummary(
    whatIKnow: string,
    whatIWant: string
  ): Promise<string> {
    return (
      `Knows: ${whatIKnow.slice(0, 300)}. ` +
      `Wants to explore: ${whatIWant.slice(0, 300)}.`
    )
  }

  // ── embed ──────────────────────────────────────────────────────────────────
  // No embedding without Nomic — returns null, which callers handle by saving
  // a profile without a vector. Matching still works via keyword path.

  async embed(
    _text:     string,
    _taskType?: 'search_document' | 'search_query'
  ): Promise<number[] | null> {
    return null
  }
}
