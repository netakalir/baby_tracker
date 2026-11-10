import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, createThrowingStorage } from '../../test/memoryStorage'
import { clearSavedCity, readSavedCity, writeSavedCity } from './savedCity'

const STORAGE_KEY = 'baby-tracker:weather:saved-city'
const RAANANA = { name: 'רעננה', latitude: 32.18, longitude: 34.87 }

describe('savedCity', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when nothing is saved', () => {
    expect(readSavedCity()).toBeNull()
  })

  it('round-trips a saved city, normalized to one-decimal coordinates', () => {
    writeSavedCity(RAANANA)
    expect(readSavedCity()).toEqual({ name: 'רעננה', latitude: 32.2, longitude: 34.9 })
  })

  it('stores only rounded coordinates and a trimmed name', () => {
    writeSavedCity({ ...RAANANA, name: '  רעננה ' })
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')).toEqual({
      name: 'רעננה',
      latitude: 32.2,
      longitude: 34.9,
    })
  })

  it('normalizes a precise value already in storage when reading it', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(RAANANA))
    expect(readSavedCity()).toEqual({ name: 'רעננה', latitude: 32.2, longitude: 34.9 })
  })

  it('clears the saved city', () => {
    writeSavedCity(RAANANA)
    clearSavedCity()
    expect(readSavedCity()).toBeNull()
  })

  it.each([
    ['malformed JSON', '{not json'],
    ['a non-object', '"רעננה"'],
    ['a missing name', JSON.stringify({ latitude: 32.18, longitude: 34.87 })],
    ['a blank name', JSON.stringify({ ...RAANANA, name: '   ' })],
    ['a string coordinate', JSON.stringify({ ...RAANANA, latitude: '32.18' })],
    ['an out-of-range latitude', JSON.stringify({ ...RAANANA, latitude: 120 })],
    ['an out-of-range longitude', JSON.stringify({ ...RAANANA, longitude: -200 })],
  ])('treats %s in storage as no saved city', (_label, raw) => {
    storage.setItem(STORAGE_KEY, raw)
    expect(readSavedCity()).toBeNull()
  })

  it('never throws when storage itself throws', () => {
    vi.stubGlobal('localStorage', createThrowingStorage())
    expect(readSavedCity()).toBeNull()
    expect(() => writeSavedCity(RAANANA)).not.toThrow()
    expect(() => clearSavedCity()).not.toThrow()
  })

  it('never throws when storage is entirely missing', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readSavedCity()).toBeNull()
    expect(() => writeSavedCity(RAANANA)).not.toThrow()
  })
})
