import { WEATHER_ICON_LABELS, type WeatherIconKind } from './weatherCode'

/**
 * Line icons for the weather strip, drawn as inline SVG with `currentColor`
 * strokes - the same approach as the Today header's week/settings icons - so
 * they inherit the surrounding text color in both themes and need no icon
 * library. Shapes are kept deliberately simple: one glance, no detail.
 */

const CLOUD = 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18Z'
/** The same cloud, lifted to make room for rain/lightning underneath. */
const HIGH_CLOUD = 'M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 7 3.5 3.5 0 0 0 7 14Z'

const ICON_PATHS: Record<WeatherIconKind, readonly string[]> = {
  clear: [
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41',
  ],
  'clear-night': ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z'],
  'partly-cloudy-night': [
    'M13.5 8.6A4.5 4.5 0 1 1 7.4 3a3.5 3.5 0 0 0 6.1 5.6Z',
    'M10 20h8a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 9 13.5 3.25 3.25 0 0 0 10 20Z',
  ],
  'partly-cloudy': [
    'M9 12a3 3 0 1 1 5.2-2.05',
    'M9 3v1.5M3 9h1.5M4.76 4.76l1.06 1.06M13.24 4.76l-1.06 1.06',
    'M10 20h8a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 9 13.5 3.25 3.25 0 0 0 10 20Z',
  ],
  cloudy: [CLOUD],
  rain: [HIGH_CLOUD, 'M8 17l-1 3M12 17l-1 3M16 17l-1 3'],
  storm: [HIGH_CLOUD, 'M13 15l-2.5 3.5h3L11 22'],
  other: ['M14 14.76V4.5a2 2 0 1 0-4 0v10.26a4 4 0 1 0 4 0Z'],
}

interface WeatherIconProps {
  kind: WeatherIconKind
  className?: string
}

/** A single weather icon with a Hebrew accessible name (e.g. "גשם"). */
export function WeatherIcon({ kind, className = '' }: WeatherIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label={WEATHER_ICON_LABELS[kind]}
      className={className}
    >
      {ICON_PATHS[kind].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
