import { describe, expect, it } from 'vitest'
import { WEATHER_ICON_LABELS, weatherIconKind, type WeatherIconKind } from './weatherCode'

describe('weatherIconKind', () => {
  it.each<[number, WeatherIconKind]>([
    [0, 'clear'],
    [1, 'partly-cloudy'],
    [2, 'partly-cloudy'],
    [3, 'cloudy'],
    [51, 'rain'],
    [57, 'rain'],
    [61, 'rain'],
    [65, 'rain'],
    [67, 'rain'],
    [80, 'rain'],
    [82, 'rain'],
    [95, 'storm'],
    [96, 'storm'],
    [99, 'storm'],
  ])('maps WMO code %s to %s', (code, kind) => {
    expect(weatherIconKind(code)).toBe(kind)
  })

  it.each([45, 48, 71, 75, 77, 85, 86, 4, 100, -1])(
    'falls back to "other" for fog, snow and unknown code %s',
    (code) => {
      expect(weatherIconKind(code)).toBe('other')
    },
  )

  it('has a Hebrew accessible label for every icon kind', () => {
    for (const label of Object.values(WEATHER_ICON_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
