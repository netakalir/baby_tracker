import type { BreastSide, Event, FeedingType } from '../../types/database'

/**
 * Typed, safe accessors for `events.metadata` (jsonb).
 *
 * The `metadata` column is intentionally flexible-by-design (see CLAUDE.md's
 * data model note) and stays `Record<string, unknown> | null` on `Event` - we
 * deliberately do NOT narrow it into a discriminated union keyed by `type`.
 * Instead, call sites read metadata through these small typed accessors rather
 * than casting/reaching into the untyped jsonb directly, so a malformed or
 * legacy record degrades to `null` instead of a bad cast.
 */

/** The feeding type ('breast' | 'bottle') of a feeding event, or null if absent/invalid. */
export function getFeedingType(event: Pick<Event, 'metadata'>): FeedingType | null {
  const value = event.metadata?.feeding_type
  return value === 'breast' || value === 'bottle' ? value : null
}

/** The breast side of a breastfeeding event, or null if absent/invalid. */
export function getBreastSide(event: Pick<Event, 'metadata'>): BreastSide | null {
  const value = event.metadata?.side
  return value === 'left' || value === 'right' ? value : null
}

/** The mood level (ordinal scale, higher is happier) of a mood event, or null if absent/invalid. */
export function getMoodLevel(event: Pick<Event, 'metadata'>): number | null {
  const value = event.metadata?.mood_level
  return typeof value === 'number' ? value : null
}
