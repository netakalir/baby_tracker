import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../../test/memoryStorage'
import { CACHED_COORDINATES_TTL_MS, readCachedCoordinates, writeCachedCoordinates } from './cachedCoordinates'
import { readDevicePosition } from './devicePosition'

type SuccessCallback = (position: { coords: { latitude: number; longitude: number } }) => void
type ErrorCallback = () => void

/** Installs a fake `navigator.geolocation` whose behaviour the test controls. */
function stubGeolocation(
  implementation: (onSuccess: SuccessCallback, onError: ErrorCallback) => void,
) {
  const getCurrentPosition = vi.fn(implementation)
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
  return getCurrentPosition
}

describe('readDevicePosition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T08:00:00Z'))
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reuses a fresh cached position without calling the Geolocation API', async () => {
    writeCachedCoordinates({ latitude: 32.2, longitude: 34.9 })
    const getCurrentPosition = stubGeolocation(() => undefined)

    await expect(readDevicePosition()).resolves.toEqual({ latitude: 32.2, longitude: 34.9 })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('asks the device again once the cache has expired, and re-caches rounded', async () => {
    writeCachedCoordinates({ latitude: 31.8, longitude: 35.2 })
    vi.advanceTimersByTime(CACHED_COORDINATES_TTL_MS)
    const getCurrentPosition = stubGeolocation((onSuccess) =>
      onSuccess({ coords: { latitude: 32.18432, longitude: 34.87119 } }),
    )

    await expect(readDevicePosition()).resolves.toEqual({ latitude: 32.2, longitude: 34.9 })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(readCachedCoordinates()).toEqual({ latitude: 32.2, longitude: 34.9 })
  })

  it('resolves null (never rejects) when the device refuses', async () => {
    stubGeolocation((_onSuccess, onError) => onError())

    await expect(readDevicePosition()).resolves.toBeNull()
    expect(readCachedCoordinates()).toBeNull()
  })

  it('resolves null when the browser never answers the prompt', async () => {
    stubGeolocation(() => undefined)

    const result = readDevicePosition()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(result).resolves.toBeNull()
  })

  it('resolves null when there is no Geolocation API', async () => {
    vi.stubGlobal('navigator', {})

    await expect(readDevicePosition()).resolves.toBeNull()
  })
})
