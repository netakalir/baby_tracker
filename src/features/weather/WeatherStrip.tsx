import { memo, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { dressingAdviceFor } from './dressingAdvice'
import { formatDegrees } from './formatDegrees'
import type { SavedCity } from './savedCity'
import { useWeather } from './useWeather'
import { useWeatherLocation } from './useWeatherLocation'
import { WeatherIcon } from './WeatherIcon'
import { WeatherPanel, type WeatherPanelMode } from './WeatherPanel'
import { weatherIconKind } from './weatherCode'

/**
 * Shared shell for every strip state: one fixed-height row, so switching from
 * loading → ready → error never shifts the layout below it.
 */
const STRIP_CLASSES =
  'flex h-10 w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-0 px-3 text-sm shadow-sm'

/** Accessible name of the strip's landmark, stable across every state. */
const REGION_LABEL = 'מזג אוויר והמלצת לבוש'

const INTERACTIVE_CLASSES =
  'transition-colors duration-fast hover:bg-neutral-100 active:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

interface ChevronProps {
  isOpen: boolean
}

/** Disclosure chevron at the strip's end; flips when the panel is open. */
function Chevron({ isOpen }: ChevronProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`ms-auto h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-fast ${isOpen ? 'rotate-180' : ''}`}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Muted middle-dot separator between the strip's segments. */
function Separator() {
  return (
    <span aria-hidden="true" className="shrink-0 text-neutral-400">
      ·
    </span>
  )
}

/**
 * "What to dress the baby today": a slim, secondary strip under the Today
 * header. Ready state reads as one line - icon, actual temperature, dressing
 * advice (from the feels-like temperature, truncated on narrow screens), and the
 * place name in muted text. Tapping it opens a small inline panel with the
 * feels-like temperature, the full advice and location actions.
 *
 * Location comes from a saved city, else the device position (requested
 * automatically), else the strip asks the parent to choose a city. Every
 * failure is a quiet one-liner - weather is secondary information, never a red
 * error. Memoised: it takes no props, so the Today screen's once-a-second timer
 * tick never re-renders it.
 */
export const WeatherStrip = memo(function WeatherStrip() {
  const panelId = useId()
  const { location, chooseCity, locateDevice } = useWeatherLocation()
  const coordinates = location.status === 'ready' ? location.coordinates : null
  const weatherQuery = useWeather(coordinates)

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<WeatherPanelMode>('details')

  const needsCity = location.status === 'needs-city'
  // With no location at all, the only useful thing the panel can offer is search.
  const panelMode: WeatherPanelMode = needsCity ? 'search' : mode

  const togglePanel = (): void => {
    setIsOpen((open) => !open)
    setMode('details')
  }

  const handleChooseCity = (city: SavedCity): void => {
    chooseCity(city)
    setIsOpen(false)
    setMode('details')
  }

  const handleUseDeviceLocation = (): void => {
    locateDevice()
    setIsOpen(false)
    setMode('details')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false)
      setMode('details')
    }
  }

  const isLoading =
    location.status === 'locating' || (location.status === 'ready' && weatherQuery.isPending)

  if (isLoading) {
    return (
      <section aria-label={REGION_LABEL}>
        {/* Deliberately not `role="status"`: the quick-log toast owns that role
            on this screen, and a static placeholder needs no live announcement. */}
        <div className={STRIP_CLASSES} aria-busy="true">
          <span className="sr-only">טוען מזג אוויר</span>
          <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full bg-neutral-100" />
          <span aria-hidden="true" className="h-3 w-40 rounded-full bg-neutral-100" />
        </div>
      </section>
    )
  }

  const weather = weatherQuery.data ?? null

  let content: ReactNode
  if (needsCity) {
    content = <span className="truncate font-medium text-brand-600">בחרו עיר</span>
  } else if (!weather) {
    content = <span className="truncate text-neutral-600">מזג האוויר לא זמין כרגע</span>
  } else {
    const placeName = location.status === 'ready' ? location.placeName : null
    content = (
      <>
        <WeatherIcon
          kind={weatherIconKind(weather.weatherCode)}
          className="h-5 w-5 shrink-0 text-neutral-600"
        />
        <span dir="ltr" className="shrink-0 font-semibold tabular-nums text-neutral-900">
          {formatDegrees(weather.temperature)}
        </span>
        <Separator />
        <span className="min-w-0 truncate text-neutral-800">
          {dressingAdviceFor(weather.apparentTemperature)}
        </span>
        {placeName && (
          <>
            <Separator />
            <span className="max-w-20 shrink-0 truncate text-neutral-400">{placeName}</span>
          </>
        )}
      </>
    )
  }

  return (
    <section aria-label={REGION_LABEL} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`${STRIP_CLASSES} ${INTERACTIVE_CLASSES}`}
      >
        {content}
        <Chevron isOpen={isOpen} />
      </button>

      {isOpen && (
        <WeatherPanel
          id={panelId}
          mode={panelMode}
          weather={weather}
          canUseDeviceLocation={location.status !== 'ready' || location.source !== 'device'}
          onSearchCity={() => setMode('search')}
          onChooseCity={handleChooseCity}
          onUseDeviceLocation={handleUseDeviceLocation}
        />
      )}
    </section>
  )
})
