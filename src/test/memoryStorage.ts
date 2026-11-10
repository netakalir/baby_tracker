/**
 * Test-only helpers: a minimal in-memory `Storage` for unit tests that run in
 * vitest's `node` environment (which has no `localStorage`), plus a variant
 * whose every method throws, to exercise "storage disabled / private mode".
 * Install with `vi.stubGlobal('localStorage', createMemoryStorage())`.
 */
export function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
  }
}

/** A `Storage` whose every access throws, like a browser with storage disabled. */
export function createThrowingStorage(): Storage {
  const fail = (): never => {
    throw new Error('SecurityError: storage is disabled')
  }
  return {
    get length(): number {
      return fail()
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}
