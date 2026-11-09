import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage } from '../../test/memoryStorage'
import { CACHED_COORDINATES_TTL_MS, readCachedCoordinates, writeCachedCoordinates } from './cachedCoordinates'
import { classifyPositionError, readDevicePosition, requestDevicePosition } from './devicePosition'

type SuccessCallback = (position: { coords: { latitude: number; longitude: number } }) => void
type ErrorCallback = (error: { code: number }) => void

/** `GeolocationPositionError` codes. */
const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

interface NavigatorStub {
  geolocation: (onSuccess: SuccessCallback, onError: ErrorCallback) => void
  /** Permissions API result; omit for a browser without the API, `'throws'` for a failing query. */
  permission?: PermissionState | 'throws'
}

/** Installs a fake `navigator` (geolocation + optional Permissions API) the test controls. */
function stubNavigator({ geolocation, permission }: NavigatorStub) {
  const getCurrentPosition = vi.fn(geolocation)
  const query = vi.fn(async () => {
    if (permission === 'throws') throw new TypeError('unsupported permission name')
    return { state: permission }
  })
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    ...(permission === undefined ? {} : { permissions: { query } }),
  })
  return getCurrentPosition
}

const PRECISE = { latitude: 32.18432, longitude: 34.87119 }
const ROUNDED = { latitude: 32.2, longitude: 34.9 }

describe('classifyPositionError', () => {
  it('classifies PERMISSION_DENIED as denied', () => {
    expect(classifyPositionError(PERMISSION_DENIED)).toBe('denied')
  })

  it.each([POSITION_UNAVAILABLE, TIMEOUT, 0, 99])('classifies code %s as unavailable', (code) => {
    expect(classifyPositionError(code)).toBe('unavailable')
  })
})

describe('device position', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T08:00:00Z'))
    vi.stubGlobal('localStorage', createMemoryStorage())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('readDevicePosition (automatic, cache-first)', () => {
    it('reuses a fresh cached position without calling the Geolocation API', async () => {
      writeCachedCoordinates(ROUNDED)
      const getCurrentPosition = stubNavigator({ geolocation: () => undefined })

      await expect(readDevicePosition()).resolves.toEqual({ status: 'located', coordinates: ROUNDED })
      expect(getCurrentPosition).not.toHaveBeenCalled()
    })

    it('asks the device again once the cache has expired, and re-caches rounded', async () => {
      writeCachedCoordinates({ latitude: 31.8, longitude: 35.2 })
      vi.advanceTimersByTime(CACHED_COORDINATES_TTL_MS)
      const getCurrentPosition = stubNavigator({
        geolocation: (onSuccess) => onSuccess({ coords: PRECISE }),
      })

      await expect(readDevicePosition()).resolves.toEqual({ status: 'located', coordinates: ROUNDED })
      expect(getCurrentPosition).toHaveBeenCalledTimes(1)
      expect(readCachedCoordinates()).toEqual(ROUNDED)
    })
  })

  describe('requestDevicePosition (explicit tap, fresh)', () => {
    it('ignores a fresh cache and asks the device', async () => {
      writeCachedCoordinates({ latitude: 31.8, longitude: 35.2 })
      const getCurrentPosition = stubNavigator({
        geolocation: (onSuccess) => onSuccess({ coords: PRECISE }),
        permission: 'granted',
      })

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'located', coordinates: ROUNDED })
      expect(getCurrentPosition).toHaveBeenCalledTimes(1)
      expect(readCachedCoordinates()).toEqual(ROUNDED)
    })

    it('reports denied without calling the Geolocation API when permission is denied', async () => {
      const getCurrentPosition = stubNavigator({ geolocation: () => undefined, permission: 'denied' })

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'denied' })
      expect(getCurrentPosition).not.toHaveBeenCalled()
    })

    it.each<[string, PermissionState | 'throws' | undefined]>([
      ['prompt', 'prompt'],
      ['no Permissions API', undefined],
      ['a failing permissions query', 'throws'],
    ])('still asks the device with %s', async (_label, permission) => {
      const getCurrentPosition = stubNavigator({
        geolocation: (onSuccess) => onSuccess({ coords: PRECISE }),
        permission,
      })

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'located', coordinates: ROUNDED })
      expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it('classifies a PERMISSION_DENIED error as denied and leaves the cache untouched', async () => {
      writeCachedCoordinates({ latitude: 31.8, longitude: 35.2 })
      stubNavigator({
        geolocation: (_onSuccess, onError) => onError({ code: PERMISSION_DENIED }),
        permission: 'prompt',
      })

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'denied' })
      expect(readCachedCoordinates()).toEqual({ latitude: 31.8, longitude: 35.2 })
    })

    it.each([POSITION_UNAVAILABLE, TIMEOUT])('classifies error code %s as unavailable', async (code) => {
      stubNavigator({ geolocation: (_onSuccess, onError) => onError({ code }) })

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'unavailable' })
    })

    it('reports unavailable when the browser never answers the prompt', async () => {
      stubNavigator({ geolocation: () => undefined })

      const result = requestDevicePosition()
      await vi.advanceTimersByTimeAsync(30_000)
      await expect(result).resolves.toEqual({ status: 'unavailable' })
    })

    it('reports unavailable when there is no Geolocation API', async () => {
      vi.stubGlobal('navigator', {})

      await expect(requestDevicePosition()).resolves.toEqual({ status: 'unavailable' })
    })
  })
})
