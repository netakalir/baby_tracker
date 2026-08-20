import { useEffect, type ReactNode } from 'react'
import type { AppTheme } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { useUserPreferences } from '../settings/useUserPreferences'
import { applyThemeClass, SYSTEM_DARK_QUERY } from './applyTheme'

/**
 * Default before a preference has loaded (or for a signed-out user). Mirrors the
 * user_preferences `theme` column default, so the first paint matches whatever
 * the OS is set to rather than forcing light.
 */
const DEFAULT_THEME: AppTheme = 'system'

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * Applies the signed-in user's persisted `theme` preference to the document
 * root, so the neutral token overrides under `.dark` in index.css take effect
 * app-wide. For 'system' it follows the OS `prefers-color-scheme` and updates
 * live when the OS scheme changes. The preference is read through the shared
 * TanStack Query hook (`useUserPreferences`), so changing it on the Display
 * settings screen re-themes the whole app immediately, without a reload.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { user } = useAuth()
  const preferencesQuery = useUserPreferences(user?.id)
  const theme = preferencesQuery.data?.theme ?? DEFAULT_THEME

  useEffect(() => {
    applyThemeClass(theme)

    // Live-follow the OS scheme only while the preference is 'system'; an
    // explicit light/dark choice must not react to OS changes.
    if (theme !== 'system') {
      return
    }

    const media = window.matchMedia(SYSTEM_DARK_QUERY)
    const handleSchemeChange = () => applyThemeClass('system')
    media.addEventListener('change', handleSchemeChange)
    return () => media.removeEventListener('change', handleSchemeChange)
  }, [theme])

  return <>{children}</>
}
