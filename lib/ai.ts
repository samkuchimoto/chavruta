/**
 * lib/ai.ts — public shim for matching/AI operations
 *
 * Delegates entirely to container.matching.
 * Every existing import in the codebase (`import { findBestMatch } from '@/lib/ai'`)
 * continues to work without modification. The adapter that executes the call
 * is determined by the container based on what's configured.
 *
 * To add a new matching capability, write an adapter and update container.ts.
 * This file does not change.
 */

import { container } from '@/lib/container'

// Re-export types so call sites can import them from '@/lib/ai' as before
export type { MatchProfile, MatchCandidate, TextOption } from '@/lib/ports/matching'

export const findBestMatch         = container.matching.findBestMatch.bind(container.matching)
export const selectSourceText      = container.matching.selectSourceText.bind(container.matching)
export const generateProfileSummary = container.matching.generateProfileSummary.bind(container.matching)
export const embed                 = container.matching.embed.bind(container.matching)
