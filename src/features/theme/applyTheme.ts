import type { AppTheme } from '../../types/database'

/** The class toggled on <html> that activates the dark token overrides. */
const DARK_CLASS = 'dark'

/** Media query used both to resolve and to live-follow the OS color scheme. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

/** Whether the OS currently prefers a dark color scheme. */
export function prefersDarkScheme(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

/**
 * Resolves a stored preference to the concrete scheme to render right now:
 * 'system' follows the OS, otherwise the explicit choice wins.
 */
export function resolveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'system') {
    return prefersDarkScheme() ? 'dark' : 'light'
  }
  return theme
}

/** Toggles the root `dark` class so the token overrides in index.css apply. */
export function applyThemeClass(theme: AppTheme): void {
  const isDark = resolveTheme(theme) === 'dark'
  document.documentElement.classList.toggle(DARK_CLASS, isDark)
}
