/**
 * The mood scale shared across the app. A mood event stores its ordinal
 * `mood_level` in `metadata.mood_level` (higher is happier); this is the single
 * source of truth mapping that level to its emoji + Hebrew label, reused by the
 * Today quick-log menu and the Week screen's dominant-mood row so both render
 * the same face for the same level.
 */
export interface MoodOption {
  /** Stored in `metadata.mood_level` - higher is happier. */
  level: number
  emoji: string
  label: string
}

/**
 * Mood options, worst to best. `mood_level` is a small ordinal scale so it can
 * be averaged/charted later without another migration (metadata is jsonb).
 */
export const MOOD_OPTIONS: readonly MoodOption[] = [
  { level: 1, emoji: '😢', label: 'בוכה' },
  { level: 2, emoji: '😕', label: 'לא רגוע' },
  { level: 3, emoji: '😊', label: 'רגוע' },
  { level: 4, emoji: '😄', label: 'שמח' },
]

const EMOJI_BY_LEVEL: Readonly<Record<number, string>> = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.level, option.emoji]),
)

/** The emoji for a stored `mood_level`, or `null` if the level is unknown. */
export function moodEmoji(level: number): string | null {
  return EMOJI_BY_LEVEL[level] ?? null
}
