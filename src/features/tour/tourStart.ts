/**
 * How the tour starts on its own: once, right after a parent finishes
 * onboarding (adds the first child or joins a family).
 *
 * The onboarding screen raises a one-shot, in-memory request just before it
 * hands over to Today, and Today consumes it on mount. A module-level flag
 * rather than router state, because the hand-over is not always our own
 * `navigate` call: the add-child screen's onboarding guard redirects to Today by
 * itself as soon as the status turns "ready", and that redirect carries no
 * state.
 *
 * Nothing is persisted: a reload, or any later visit to Today, never starts the
 * tour on its own. The header menu can always start it again.
 */

let isRequested = false

/** Asks Today to start the tour the next time it mounts. */
export function requestTourOnArrival(): void {
  isRequested = true
}

/**
 * Whether a start was requested. Read-only, so it is safe to call during render
 * (StrictMode may render twice); `clearTourRequest` consumes it from an effect.
 */
export function isTourRequested(): boolean {
  return isRequested
}

/** Consumes the request, so it applies to a single arrival only. */
export function clearTourRequest(): void {
  isRequested = false
}
