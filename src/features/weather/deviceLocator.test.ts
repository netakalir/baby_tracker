import { describe, expect, it, vi } from 'vitest'
import type { DevicePositionResult } from './devicePosition'
import { createDeviceLocator, type LocateEffects } from './deviceLocator'

const JERUSALEM: DevicePositionResult = {
  status: 'located',
  coordinates: { latitude: 31.8, longitude: 35.2 },
}

/** A device request the test resolves by hand - a prompt left open, or a slow fix. */
function deferredRequest() {
  let resolve: (result: DevicePositionResult) => void = () => undefined
  const promise = new Promise<DevicePositionResult>((settle) => {
    resolve = settle
  })
  return { request: () => promise, resolve }
}

/** Effects with spies, plus a tiny model of the hook's saved-city state. */
function effectsFor(request: LocateEffects['request']) {
  const state = { savedCity: 'נתניה' as string | null, cachedPosition: null as unknown }
  const setPending = vi.fn()
  const apply = vi.fn((result: DevicePositionResult) => {
    if (result.status === 'located') {
      state.savedCity = null
      state.cachedPosition = result.coordinates
    }
  })
  return { effects: { request, setPending, apply }, state, setPending, apply }
}

describe('createDeviceLocator', () => {
  it('applies and resolves a current result', async () => {
    const locator = createDeviceLocator()
    const { effects, state, setPending, apply } = effectsFor(async () => JERUSALEM)

    await expect(locator.locate(effects)).resolves.toEqual(JERUSALEM)
    expect(apply).toHaveBeenCalledWith(JERUSALEM)
    expect(setPending.mock.calls).toEqual([[true], [false]])
    expect(state.savedCity).toBeNull()
  })

  it('also applies a current failure (so the hook can explain it)', async () => {
    const locator = createDeviceLocator()
    const { effects, apply } = effectsFor(async () => ({ status: 'denied' }))

    await expect(locator.locate(effects)).resolves.toEqual({ status: 'denied' })
    expect(apply).toHaveBeenCalledWith({ status: 'denied' })
  })

  it('resolves null and changes nothing when a city is chosen while waiting', async () => {
    const locator = createDeviceLocator()
    const device = deferredRequest()
    const { effects, state, setPending, apply } = effectsFor(device.request)

    const pending = locator.locate(effects)
    // The hook's chooseCity: cancel the pending locate, then save the city.
    locator.cancel()
    state.savedCity = 'רעננה'

    device.resolve(JERUSALEM)
    await expect(pending).resolves.toBeNull()
    expect(apply).not.toHaveBeenCalled()
    expect(state).toEqual({ savedCity: 'רעננה', cachedPosition: null })
    // Only the start was reported; the hook's cancel already cleared "pending".
    expect(setPending.mock.calls).toEqual([[true]])
  })

  it('resolves null when cancelled (search started, panel closed, screen left)', async () => {
    const locator = createDeviceLocator()
    const device = deferredRequest()
    const { effects, apply } = effectsFor(device.request)

    const pending = locator.locate(effects)
    locator.cancel()
    device.resolve({ status: 'unavailable' })

    await expect(pending).resolves.toBeNull()
    expect(apply).not.toHaveBeenCalled()
  })

  it('lets only the newest of two overlapping attempts apply', async () => {
    const locator = createDeviceLocator()
    const first = deferredRequest()
    const second = deferredRequest()
    const firstEffects = effectsFor(first.request)
    const secondEffects = effectsFor(second.request)

    const firstPending = locator.locate(firstEffects.effects)
    const secondPending = locator.locate(secondEffects.effects)
    second.resolve({ status: 'denied' })
    first.resolve(JERUSALEM)

    await expect(secondPending).resolves.toEqual({ status: 'denied' })
    await expect(firstPending).resolves.toBeNull()
    expect(firstEffects.apply).not.toHaveBeenCalled()
    expect(secondEffects.apply).toHaveBeenCalledTimes(1)
  })

  it('a cancel with nothing pending does not block a later attempt', async () => {
    const locator = createDeviceLocator()
    locator.cancel()
    const { effects, apply } = effectsFor(async () => JERUSALEM)

    await expect(locator.locate(effects)).resolves.toEqual(JERUSALEM)
    expect(apply).toHaveBeenCalledTimes(1)
  })
})
