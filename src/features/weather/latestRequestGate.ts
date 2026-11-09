/**
 * Tracks which of several overlapping async requests is still "the current
 * one", so a slow, superseded result can be ignored instead of overwriting a
 * newer decision. Each `begin()` returns a token; `invalidate()` (or a later
 * `begin()`) makes every earlier token stale.
 *
 * Used by "use my location": if the parent gives up on a slow geolocation
 * request and picks a city (or closes the panel), the late result must not
 * clear that city or steal focus.
 */
export interface LatestRequestGate {
  /** Starts a new request and returns its token. */
  begin: () => number
  /** Makes every outstanding token stale. */
  invalidate: () => void
  /** True when `token` belongs to the most recent, not-invalidated request. */
  isCurrent: (token: number) => boolean
}

export function createLatestRequestGate(): LatestRequestGate {
  let current = 0
  return {
    begin: () => {
      current += 1
      return current
    },
    invalidate: () => {
      current += 1
    },
    isCurrent: (token) => token === current,
  }
}
