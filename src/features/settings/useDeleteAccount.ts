import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { deleteAccount } from './api'

/**
 * Deletes the signed-in user's account ("leave only", spec §6): invokes the
 * `delete-user` Edge Function, then clears the query cache and signs out so the
 * app returns to the auth screen. Shared family data survives for the other
 * parent (see `deleteAccount` / the Edge Function).
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, void>({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await supabase.auth.signOut()
      queryClient.clear()
    },
  })
}
