import { describe, expect, it } from 'vitest'
import { createLatestRequestGate } from './latestRequestGate'

/** Resolves on a later macrotask, like a slow geolocation result. */
function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 0))
}

describe('createLatestRequestGate', () => {
  it('treats the most recent request as current', () => {
    const gate = createLatestRequestGate()
    const token = gate.begin()
    expect(gate.isCurrent(token)).toBe(true)
  })

  it('makes an earlier request stale when a newer one begins', () => {
    const gate = createLatestRequestGate()
    const first = gate.begin()
    const second = gate.begin()
    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
  })

  it('makes a pending request stale when invalidated (city chosen / panel closed)', () => {
    const gate = createLatestRequestGate()
    const token = gate.begin()
    gate.invalidate()
    expect(gate.isCurrent(token)).toBe(false)
  })

  it('drops a slow result that resolves after the parent chose a city', async () => {
    const gate = createLatestRequestGate()
    let appliedLocation = 'saved city: נתניה'

    // "Use my location" starts; geolocation is slow.
    const token = gate.begin()
    const pendingPosition = later('device: ירושלים')

    // Meanwhile the parent gives up and picks a city - which invalidates the gate.
    gate.invalidate()
    appliedLocation = 'saved city: רעננה'

    // The late success must not overwrite the explicit choice.
    const position = await pendingPosition
    if (gate.isCurrent(token)) appliedLocation = position

    expect(appliedLocation).toBe('saved city: רעננה')
  })

  it('keeps separate gates independent', () => {
    const a = createLatestRequestGate()
    const b = createLatestRequestGate()
    const tokenA = a.begin()
    b.invalidate()
    expect(a.isCurrent(tokenA)).toBe(true)
  })
})
