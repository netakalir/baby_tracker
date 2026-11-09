import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, createThrowingStorage } from '../../test/memoryStorage'
import {
  CACHED_COORDINATES_TTL_MS,
  clearCachedCoordinates,
  readCachedCoordinates,
  writeCachedCoordinates,
} from './cachedCoordinates'

const STORAGE_KEY = 'baby-tracker:weather:device-coordinates'
const NOW = new Date('2026-11-09T08:00:00Z')

describe('cachedCoordinates', () => {
  let storage: Storage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns null when nothing is cached', () => {
    expect(readCachedCoordinates()).toBeNull()
  })

  it('stores only coordinates rounded to one decimal', () => {
    writeCachedCoordinates({ latitude: 32.18432, longitude: 34.87119 })

    const stored: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({ latitude: 32.2, longitude: 34.9, savedAt: NOW.getTime() })
    expect(readCachedCoordinates()).toEqual({ latitude: 32.2, longitude: 34.9 })
  })

  it('stays fresh until just before the 3-hour TTL', () => {
    writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })

    vi.advanceTimersByTime(CACHED_COORDINATES_TTL_MS - 1)
    expect(readCachedCoordinates()).toEqual({ latitude: 32.2, longitude: 34.9 })
  })

  it('expires exactly at the 3-hour TTL', () => {
    writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })

    vi.advanceTimersByTime(CACHED_COORDINATES_TTL_MS)
    expect(readCachedCoordinates()).toBeNull()
  })

  it('treats a timestamp from the future (clock moved back) as stale', () => {
    writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })

    vi.setSystemTime(NOW.getTime() - 60_000)
    expect(readCachedCoordinates()).toBeNull()
  })

  it('clears the cache', () => {
    writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })
    clearCachedCoordinates()
    expect(readCachedCoordinates()).toBeNull()
  })

  it.each([
    ['malformed JSON', '{oops'],
    ['a missing timestamp', JSON.stringify({ latitude: 32.2, longitude: 34.9 })],
    ['a string timestamp', JSON.stringify({ latitude: 32.2, longitude: 34.9, savedAt: 'now' })],
    ['an out-of-range latitude', JSON.stringify({ latitude: 91, longitude: 34.9, savedAt: NOW.getTime() })],
  ])('treats %s in storage as no cache', (_label, raw) => {
    storage.setItem(STORAGE_KEY, raw)
    expect(readCachedCoordinates()).toBeNull()
  })

  it('never throws when storage itself throws', () => {
    vi.stubGlobal('localStorage', createThrowingStorage())
    expect(readCachedCoordinates()).toBeNull()
    expect(() => writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })).not.toThrow()
    expect(() => clearCachedCoordinates()).not.toThrow()
  })
})
