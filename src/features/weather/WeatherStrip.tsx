import { memo, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { dressingAdviceFor } from './dressingAdvice'
import { formatDegrees } from './formatDegrees'
import type { DevicePositionFailure } from './devicePosition'
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
  const stripButtonRef = useRef<HTMLButtonElement>(null)
  const { location, chooseCity, locateDevice, cancelLocateDevice, isLocatingDevice } =
    useWeatherLocation()
  const coordinates = location.status === 'ready' ? location.coordinates : null
  const weatherQuery = useWeather(coordinates)

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<WeatherPanelMode>('details')
  /** The outcome of the last "use my location" tap, if it failed. */
  const [tapFailure, setTapFailure] = useState<DevicePositionFailure | null>(null)

  const needsCity = location.status === 'needs-city'
  // With no location at all, the only useful thing the panel can offer is search.
  const panelMode: WeatherPanelMode = needsCity ? 'search' : mode

  const weather = weatherQuery.data ?? null
  // Offline, the forecast query pauses rather than failing - treat that as
  // "unavailable" instead of leaving the skeleton up indefinitely.
  const isOffline = weatherQuery.fetchStatus === 'paused' && !weather
  const isLoading =
    location.status === 'locating' ||
    (location.status === 'ready' && weatherQuery.isPending && !isOffline)

  /**
   * Closes the panel and puts focus back on the strip button. Focus moves
   * *before* the panel unmounts, so it never falls back to <body> when the
   * focused control (a search result, an action, the search field) goes away.
   * Closing also abandons a pending "use my location", so its late result can
   * neither switch the location nor pull focus back here.
   */
  const closePanel = (): void => {
    cancelLocateDevice()
    stripButtonRef.current?.focus()
    setIsOpen(false)
    setMode('details')
    setTapFailure(null)
  }

  const togglePanel = (): void => {
    // A loading strip has nothing to show yet; the tap is simply ignored.
    if (isLoading) return
    cancelLocateDevice()
    setIsOpen((open) => !open)
    setMode('details')
    setTapFailure(null)
  }

  // Switching to the city search means giving up on "use my location": a late
  // success must not close the panel (and steal focus) mid-typing.
  const handleSearchCity = (): void => {
    cancelLocateDevice()
    setMode('search')
  }

  const handleChooseCity = (city: SavedCity): void => {
    chooseCity(city)
    closePanel()
  }

  const handleUseDeviceLocation = async (): Promise<void> => {
    if (isLocatingDevice) return
    setTapFailure(null)
    const result = await locateDevice()
    // Superseded (a city was chosen or the panel closed meanwhile): do nothing.
    if (result === null) return
    // Success switches the strip to the device location; a failure keeps the
    // panel open, with everything unchanged, and explains why.
    if (result.status === 'located') closePanel()
    else setTapFailure(result.status)
  }

  // An explicit tap's outcome wins; otherwise a first-load fallback carries its reason.
  const locationFailure = tapFailure ?? (needsCity ? location.reason : null)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && isOpen) closePanel()
  }

  let content: ReactNode
  if (isLoading) {
    content = (
      <>
        <span className="sr-only">טוען מזג אוויר</span>
        <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full bg-neutral-100" />
        <span aria-hidden="true" className="h-3 w-40 rounded-full bg-neutral-100" />
      </>
    )
  } else if (needsCity) {
    content = <span className="truncate font-medium text-brand-600">בחרו עיר</span>
  } else if (!weather) {
    content = <span className="truncate text-neutral-600">מזג האוויר לא זמין כרגע</span>
  } else {
    const placeName = location.status === 'ready' ? location.placeName : null
    content = (
      <>
        <WeatherIcon
          kind={weatherIconKind(weather.weatherCode, weather.isDay)}
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
      {/* One stable button across every state (loading included), so focus
          returned to it survives state changes. Loading is conveyed with
          `aria-busy` - deliberately not `role="status"`, which the quick-log
          toast owns on this screen. */}
      <button
        ref={stripButtonRef}
        type="button"
        onClick={togglePanel}
        aria-busy={isLoading || undefined}
        aria-expanded={isOpen && !isLoading}
        aria-controls={isOpen ? panelId : undefined}
        className={`${STRIP_CLASSES} ${INTERACTIVE_CLASSES}`}
      >
        {content}
        {!isLoading && <Chevron isOpen={isOpen} />}
      </button>

      {isOpen && !isLoading && (
        <WeatherPanel
          id={panelId}
          mode={panelMode}
          weather={weather}
          canUseDeviceLocation={location.status !== 'ready' || location.source !== 'device'}
          isLocatingDevice={isLocatingDevice}
          locationFailure={locationFailure}
          onSearchCity={handleSearchCity}
          onSearchInput={cancelLocateDevice}
          onChooseCity={handleChooseCity}
          onUseDeviceLocation={() => void handleUseDeviceLocation()}
        />
      )}
    </section>
  )
})
