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
 * Upserts the full preferences row. Applies the change to the cache
 * optimistically (before the round-trip resolves) so toggles/selectors reflect
 * the new state immediately, then reconciles with the server response on
 * success or rolls back to the previous cached row on failure - the standard
 * TanStack Query optimistic-update pattern (cancel in-flight reads, snapshot,
 * write, rollback on error).
 */
export function useUpsertUserPreferences() {
  const queryClient = useQueryClient()

  return useMutation<
    UserPreferences,
    unknown,
    UserPreferencesUpsert,
    { previous: UserPreferences | null | undefined }
  >({
    mutationFn: upsertUserPreferences,
    onMutate: async (patch) => {
      const key = userPreferencesKey(patch.user_id)
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData<UserPreferences | null>(key)
      const optimistic: UserPreferences = {
        ...patch,
        updated_at: previous?.updated_at ?? new Date().toISOString(),
      }
      queryClient.setQueryData(key, optimistic)

      return { previous }
    },
    onError: (_error, patch, context) => {
      if (!context) return
      queryClient.setQueryData(userPreferencesKey(patch.user_id), context.previous)
    },
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
