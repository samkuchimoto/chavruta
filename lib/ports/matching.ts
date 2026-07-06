/**
 * lib/ports/matching.ts
 *
 * Matching port — the domain's contract for AI-assisted operations.
 *
 * This file has ZERO imports from Groq, Nomic, or any external API.
 * It defines what the business logic needs — not how it's delivered.
 * Adapters (groq.adapter.ts, keyword.adapter.ts) implement this interface.
 *
 * If Groq shuts down tomorrow, the domain layer doesn't change.
 * Only the adapter swaps.
 */

// ── Shared domain types ──────────────────────────────────────────────────────
// Defined here so ports and adapters share the same type without circular deps.

export type MatchProfile = {
  id:          string
  what_i_know: string
  what_i_want: string
}

export type MatchCandidate = {
  id:     string
  score:  number        // 0–10 complementarity score
  reason: string        // one-sentence explanation, for logging
}

export type TextOption = {
  id:        string
  title:     string
  topic_tag: string | null
}

// ── Port interface ───────────────────────────────────────────────────────────

export interface MatchingPort {
  /**
   * Given a requester and a pool of candidates, returns the ID of the best
   * complementary match — or null if nothing clears the minimum quality bar.
   * Never throws.
   */
  findBestMatch(
    requester:  MatchProfile,
    candidates: MatchProfile[]
  ): Promise<string | null>

  /**
   * Given two matched users and a list of available texts, returns the ID
   * of the most intellectually productive text for their session.
   * Never throws. Falls back to deterministic selection if necessary.
   */
  selectSourceText(
    userA:  MatchProfile,
    userB:  MatchProfile,
    texts:  TextOption[]
  ): Promise<string | null>

  /**
   * Generates a 2–3 sentence summary of a profile for embedding.
   * Never throws. Falls back to a plain concatenation if necessary.
   */
  generateProfileSummary(
    whatIKnow: string,
    whatIWant: string
  ): Promise<string>

  /**
   * Embeds text into a vector. Returns null (never throws) if the
   * embedding service is unavailable — profiles save without a vector.
   */
  embed(
    text:     string,
    taskType?: 'search_document' | 'search_query'
  ): Promise<number[] | null>
}
