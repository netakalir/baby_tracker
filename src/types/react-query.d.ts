import '@tanstack/react-query'

/**
 * Project-wide typing for TanStack Query's free-form `meta`, so every query's
 * `meta` is checked instead of being an untyped record.
 */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /**
       * Returns true for an error the owning feature considers an expected,
       * non-actionable state (e.g. a third-party outage), so the global
       * QueryCache handler does not report it to Sentry. Lets a feature opt out
       * per error without `src/lib` knowing about feature error types.
       */
      skipErrorReport?: (error: unknown) => boolean
    }
  }
}
