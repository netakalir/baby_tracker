import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

interface HeaderMenuProps {
  onOpenWeek: () => void
  onOpenCompare: () => void
  onOpenSettings: () => void
}

interface MenuItem {
  readonly id: string
  readonly label: string
  readonly icon: ReactNode
  readonly onSelect: () => void
}

/** Shared stroke attributes so every menu icon matches the app's line style. */
const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Week: the bar-chart icon the header has always used for the Week screen. */
function WeekIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" {...STROKE} />
    </svg>
  )
}

/** Day comparison: two small calendars side by side. */
function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect x="2.5" y="6" width="8.5" height="13" rx="1.5" {...STROKE} />
      <rect x="13" y="6" width="8.5" height="13" rx="1.5" {...STROKE} />
      <path d="M2.5 10.5h8.5M13 10.5h8.5M5.5 4v3.5M8 4v3.5M16 4v3.5M18.5 4v3.5" {...STROKE} />
    </svg>
  )
}

/** Settings: the gear icon the header has always used for the Settings hub. */
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" {...STROKE} />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        {...STROKE}
      />
    </svg>
  )
}

/**
 * The Today header's navigation menu: one hamburger button that opens a small
 * dropdown with Week, Day comparison and Settings. Follows the app's popup-menu
 * pattern (see QuickLogButtons): a pointer down outside dismisses it, and it
 * opens with no animation — only the items' brief tap feedback.
 *
 * The button sits at the header's end (left, in RTL), so the menu is anchored to
 * that same edge and opens inward, staying on-screen at 320px.
 *
 * Keyboard: opening moves focus to the first item; ArrowUp/ArrowDown (and
 * Home/End) move between items; Escape closes and returns focus to the button;
 * Tab closes it so focus never strands inside a hidden menu.
 */
export function HeaderMenu({ onOpenWeek, onOpenCompare, onOpenSettings }: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const items: readonly MenuItem[] = [
    { id: 'week', label: 'שבוע', icon: <WeekIcon />, onSelect: onOpenWeek },
    { id: 'compare', label: 'השוואת ימים', icon: <CompareIcon />, onSelect: onOpenCompare },
    { id: 'settings', label: 'הגדרות', icon: <SettingsIcon />, onSelect: onOpenSettings },
  ]

  // Move focus into the menu as it opens, and dismiss it on a pointer down
  // anywhere outside the trigger + menu. Both only while open.
  useEffect(() => {
    if (!isOpen) return

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()

    function handlePointerDown(event: PointerEvent) {
      if (wrapperRef.current?.contains(event.target as Node)) return
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  function menuItems(): HTMLButtonElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
  }

  function closeAndRefocus() {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const elements = menuItems()
    const current = elements.indexOf(document.activeElement as HTMLButtonElement)
    const focusAt = (index: number) => elements[(index + elements.length) % elements.length]?.focus()

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        closeAndRefocus()
        break
      case 'ArrowDown':
        event.preventDefault()
        focusAt(current + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(current - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(elements.length - 1)
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  function handleSelect(item: MenuItem) {
    setIsOpen(false)
    item.onSelect()
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="תפריט"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'today-header-menu' : undefined}
        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" {...STROKE} />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id="today-header-menu"
          role="menu"
          aria-label="תפריט"
          onKeyDown={handleMenuKeyDown}
          // Anchored to the trigger's end edge (left in RTL, where the trigger
          // sits) so the menu opens inward and never spills past the screen.
          // Absolutely positioned on the same `z-10` layer as the quick-log
          // popups, it floats over the page and never pushes the header, the
          // content below it, or the clock down.
          className="absolute end-0 top-full z-10 mt-2 flex min-w-40 flex-col items-stretch gap-1 rounded-lg border border-neutral-200 bg-neutral-0 p-2 shadow-md"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(item)}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-start text-sm font-medium text-neutral-800 transition-transform duration-fast active:scale-95 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="text-neutral-600">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
