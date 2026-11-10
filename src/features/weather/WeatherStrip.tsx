import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
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
  // The strip + its popover. A pointer down outside it, or focus leaving it,
  // closes the popover.
  const containerRef = useRef<HTMLElement>(null)
  // True from a pointer press inside the container until that pointer is
  // released. Safari (and iOS) don't focus a button on click, so pressing a
  // search result blurs the field with no focus target - that must not be
  // read as "focus left the popover" before the click lands.
  const isPointerDownInsideRef = useRef(false)
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
   * Closes the panel, and abandons a pending "use my location" so its late
   * result can neither switch the location nor pull focus back here.
   *
   * Focus: if it is inside the container when this runs (a search result, an
   * action, the search field), it moves to the strip button *before* the panel
   * unmounts, so it never falls back to <body>; if it is already outside (focus
   * left via Tab - see `handleBlur`), it is left alone. An outside tap runs this
   * from `pointerdown`, which fires BEFORE the browser moves focus: so focus is
   * typically still inside, briefly lands on the strip button, and the
   * browser's default mousedown handling then moves it to the tapped element
   * (or to <body> for a non-focusable spot).
   *
   * `focusStrip: true` always returns focus to the strip - for an explicit
   * action taken inside the panel (choosing a city, a successful "use my
   * location"), including in Safari, where clicking a button leaves focus on
   * <body> rather than inside the panel. Stable: every dependency is a ref, a
   * setter or itself stable.
   */
  const closePanel = useCallback(
    ({ focusStrip = false }: { focusStrip?: boolean } = {}): void => {
      cancelLocateDevice()
      const isFocusInside = containerRef.current?.contains(document.activeElement) ?? false
      const isFocusNowhere = document.activeElement === null || document.activeElement === document.body
      if (isFocusInside || (focusStrip && isFocusNowhere)) {
        stripButtonRef.current?.focus()
      }
      setIsOpen(false)
      setMode('details')
      setTapFailure(null)
    },
    [cancelLocateDevice],
  )

  // Dismiss the popover when the parent taps anywhere outside it - the same
  // pattern as the quick-log menus. A tap on the strip itself stays inside the
  // container and is left to the strip's own toggle; a tap inside the popover
  // is ignored. Attached only while open; `pointerdown` covers touch and mouse.
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      closePanel()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, closePanel])

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
    closePanel({ focusStrip: true })
  }

  const handleUseDeviceLocation = async (): Promise<void> => {
    if (isLocatingDevice) return
    setTapFailure(null)
    const result = await locateDevice()
    // Superseded (a city was chosen or the panel closed meanwhile): do nothing.
    if (result === null) return
    // Success switches the strip to the device location; a failure keeps the
    // panel open, with everything unchanged, and explains why.
    if (result.status === 'located') closePanel({ focusStrip: true })
    else setTapFailure(result.status)
  }

  // An explicit tap's outcome wins; otherwise a first-load fallback carries its reason.
  const locationFailure = tapFailure ?? (needsCity ? location.reason : null)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && isOpen) closePanel()
  }

  const handlePointerDownInside = (): void => {
    isPointerDownInsideRef.current = true
    const release = (): void => {
      isPointerDownInsideRef.current = false
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointercancel', release, true)
    }
    window.addEventListener('pointerup', release, true)
    window.addEventListener('pointercancel', release, true)
  }

  /**
   * Closes the popover when keyboard focus leaves the strip + popover (e.g.
   * Shift+Tab to the header), so it can't sit open over another menu. It never
   * moves focus: by the time this runs focus is already outside, and
   * `closePanel` only restores focus that is inside.
   *
   * Not a close: focus moving within the container; a pointer press inside
   * (Safari's no-focus-on-click blurs with no target before the click lands);
   * and a focused element inside being replaced (e.g. "החלף עיר" unmounting as
   * the search field auto-focuses) - which is why a missing/outside target is
   * re-checked after the DOM settles rather than acted on at once.
   */
  const handleBlur = (event: FocusEvent<HTMLElement>): void => {
    if (!isOpen) return
    const next = event.relatedTarget
    if (next instanceof Node && containerRef.current?.contains(next)) return
    if (isPointerDownInsideRef.current) return

    requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container || container.contains(document.activeElement)) return
      if (isPointerDownInsideRef.current) return
      closePanel()
    })
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
    // `relative`: the popover is positioned against the strip, so opening it
    // never moves the strip or the page below.
    <section
      ref={containerRef}
      aria-label={REGION_LABEL}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onPointerDown={handlePointerDownInside}
      className="relative"
    >
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
