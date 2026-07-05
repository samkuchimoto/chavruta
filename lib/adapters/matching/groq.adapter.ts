/**
 * lib/adapters/matching/groq.adapter.ts
 *
 * Groq + Nomic matching adapter — implements MatchingPort using AI scoring.
 *
 * Falls back to the KeywordMatchingAdapter on every failure path:
 *   - Groq not configured → keyword fallback
 *   - Groq API error       → keyword fallback + console.error
 *   - Nomic not configured → embed returns null (callers handle gracefully)
 *   - Nomic API error      → embed returns null + console.error
 *
 * The contract: this adapter never throws and never breaks the call site
 * that invokes it. Every error is internal, logged, and absorbed.
 */

import Groq from 'groq-sdk'
import type { MatchingPort, MatchProfile, MatchCandidate, TextOption } from '@/lib/ports/matching'
import { KeywordMatchingAdapter } from './keyword.adapter'
import { config } from '@/lib/config'

const REASONING_MODEL    = 'llama-3.3-70b-versatile'
const NOMIC_EMBED_URL    = 'https://api-atlas.nomic.ai/v1/embedding/text'
const NOMIC_MODEL        = 'nomic-embed-text-v1.5'
const MAX_CANDIDATES     = 30
const MIN_SCORE          = 5

// ── Groq client (lazy) ───────────────────────────────────────────────────────
let _groq: Groq | null = null
function getGroq(): Groq {
  if (_groq) return _groq
  _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const MATCH_SYSTEM = `You are a complementarity matching engine for paired intellectual sessions.

Score each candidate 0–10 on true complementarity:
  - The requester's knowledge fills the candidate's stated wants
  - The candidate's knowledge fills the requester's stated wants
  - Higher score = each fills the other's exact gap; neither is redundant

Return ONLY a JSON array sorted by score descending. No preamble, no markdown fences.
Format: [{"id":"uuid","score":8,"reason":"one sentence"}]`

const SUMMARIZE_SYSTEM = `Extract a concise 2–3 sentence intellectual profile for semantic embedding.
Capture: concrete knowledge domains, intellectual territory wanted, distinctive thinking angle.
Third person. Specific. Output only the profile text.`

const TEXT_SELECT_SYSTEM = `Select the most intellectually productive source text for a paired reading session.
Both people should have something to contribute and something to gain.
Return only the UUID. No other output.`

// ── Adapter ──────────────────────────────────────────────────────────────────

export class GroqMatchingAdapter implements MatchingPort {

  private readonly fallback = new KeywordMatchingAdapter()

  // ── callGroq (private) ───────────────────────────────────────────────────
  private async callGroq(
    messages:    { role: 'system' | 'user' | 'assistant'; content: string }[],
    max_tokens = 1024,
  ): Promise<string> {
    const completion = await getGroq().chat.completions.create({
      model:       REASONING_MODEL,
      messages,
      temperature: 0.1,
      max_tokens,
    })
    const content = completion.choices[0]?.message?.content
    if (!content) throw new Error('[groq] empty response')
    return content.trim()
  }

  // ── findBestMatch ──────────────────────────────────────────────────────────

  async findBestMatch(
    requester:  MatchProfile,
    candidates: MatchProfile[]
  ): Promise<string | null> {
    if (candidates.length === 0) return null

    try {
      const pool = candidates.slice(0, MAX_CANDIDATES)

      const candidateList = pool
        .map((c, i) => `[${i + 1}] ID: ${c.id}\nKnows: ${c.what_i_know}\nWants: ${c.what_i_want}`)
        .join('\n\n')

      const raw = await this.callGroq([
        { role: 'system', content: MATCH_SYSTEM },
        {
          role: 'user',
          content:
            `REQUESTER:\nKnows: ${requester.what_i_know}\nWants: ${requester.what_i_want}\n\n` +
            `CANDIDATES:\n${candidateList}`,
        },
      ], 512)

      const cleaned = raw.replace(/```(?:json)?/g, '').trim()
      const ranked  = JSON.parse(cleaned) as MatchCandidate[]
      ranked.sort((a, b) => b.score - a.score)

      const best = ranked[0]
      if (!best || best.score < MIN_SCORE) return null
      return best.id

    } catch (err) {
      console.error('[groq] findBestMatch failed, falling back to keyword:', err)
      return this.fallback.findBestMatch(requester, candidates)
    }
  }

  // ── selectSourceText ───────────────────────────────────────────────────────

  async selectSourceText(
    userA:  MatchProfile,
    userB:  MatchProfile,
    texts:  TextOption[]
  ): Promise<string | null> {
    if (texts.length === 0) return null

    try {
      const textList = texts
        .map((t, i) => `[${i + 1}] ID: ${t.id} | ${t.topic_tag ?? 'general'} | ${t.title}`)
        .join('\n')

      const result = await this.callGroq([
        { role: 'system', content: TEXT_SELECT_SYSTEM },
        {
          role: 'user',
          content:
            `Person A knows: ${userA.what_i_know}\nPerson A wants: ${userA.what_i_want}\n\n` +
            `Person B knows: ${userB.what_i_know}\nPerson B wants: ${userB.what_i_want}\n\n` +
            `Available texts:\n${textList}\n\nReturn ONLY the ID.`,
        },
      ], 64)

      const match = result.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      )
      return match?.[0] ?? this.fallback.selectSourceText(userA, userB, texts)

    } catch (err) {
      console.error('[groq] selectSourceText failed, using fallback:', err)
      return this.fallback.selectSourceText(userA, userB, texts)
    }
  }

  // ── generateProfileSummary ─────────────────────────────────────────────────

  async generateProfileSummary(
    whatIKnow: string,
    whatIWant: string
  ): Promise<string> {
    try {
      return await this.callGroq([
        { role: 'system', content: SUMMARIZE_SYSTEM },
        {
          role: 'user',
          content: `What I know:\n${whatIKnow}\n\nWhat I want to explore:\n${whatIWant}`,
        },
      ], 256)
    } catch (err) {
      console.error('[groq] generateProfileSummary failed, using fallback:', err)
      return this.fallback.generateProfileSummary(whatIKnow, whatIWant)
    }
  }

  // ── embed ──────────────────────────────────────────────────────────────────

  async embed(
    text:      string,
    taskType:  'search_document' | 'search_query' = 'search_document'
  ): Promise<number[] | null> {
    if (!config.nomic) return null

    try {
      const res = await fetch(NOMIC_EMBED_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOMIC_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model:     NOMIC_MODEL,
          texts:     [text],
          task_type: taskType,
        }),
      })

      if (!res.ok) {
        console.error(`[nomic] embed failed ${res.status}`)
        return null
      }

      const data = await res.json() as { embeddings: number[][] }
      return data.embeddings?.[0] ?? null

    } catch (err) {
      console.error('[nomic] embed threw:', err)
      return null
    }
  }
}
