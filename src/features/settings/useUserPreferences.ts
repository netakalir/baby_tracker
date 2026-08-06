import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserPreferences, UserPreferencesUpsert } from '../../types/database'
import {
  fetchUserPreferences,
  updateDisplayName,
  upsertUserPreferences,
} from './api'

/**
 * The query key for the signed-in user's private preferences row. Keyed by user
 * id so a different account never reads another user's cached settings, and so
 * every settings sub-screen (Profile, Display, Notifications) shares one cache
 * entry rather than three divergent ones.
 */
export function userPreferencesKey(userId: string): [string, string] {
  return ['user-preferences', userId]
}

/** Reads the signed-in user's `user_preferences` row (or `null` if none yet). */
export function useUserPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: userPreferencesKey(userId ?? ''),
    queryFn: () => fetchUserPreferences(userId!),
    enabled: Boolean(userId),
  })
}

/**
 * Upserts the full preferences row and writes the returned row straight into the
 * cache, so a change made on one settings sub-screen is reflected on the others
 * without a refetch.
 */
export function useUpsertUserPreferences() {
  const queryClient = useQueryClient()

  return useMutation<UserPreferences, unknown, UserPreferencesUpsert>({
    mutationFn: upsertUserPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(userPreferencesKey(updated.user_id), updated)
    },
  })
}

/** Saves only the display name (partial upsert) and refreshes the cached row. */
export function useUpdateDisplayName(userId: string) {
  const queryClient = useQueryClient()

  return useMutation<UserPreferences, unknown, string>({
    mutationFn: (displayName) => updateDisplayName(userId, displayName),
    onSuccess: (updated) => {
      queryClient.setQueryData(userPreferencesKey(updated.user_id), updated)
    },
  })
}
