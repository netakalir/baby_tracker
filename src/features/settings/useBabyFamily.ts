import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Child, FamilyInvite } from '../../types/database'
import { useAuth } from '../auth/useAuth'
import { createFamilyInvite, fetchFamilyMembers, updateBabyDetails } from './api'

/** Query key for a family's members-with-identity list. */
export function familyMembersKey(familyId: string): [string, string] {
  return ['family-members', familyId]
}

/** Reads the family's members with their display name + email (via the RPC). */
export function useFamilyMembers(familyId: string) {
  return useQuery({
    queryKey: familyMembersKey(familyId),
    queryFn: () => fetchFamilyMembers(familyId),
  })
}

export interface UpdateBabyDetailsInput {
  name: string
  birthDate: string
}

/**
 * Saves the child's name + birth date, then invalidates the onboarding-status
 * query (which carries the first child) so the rest of the app sees the update.
 */
export function useUpdateBabyDetails(childId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation<Child, unknown, UpdateBabyDetailsInput>({
    mutationFn: (input) => updateBabyDetails(childId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-status', user?.id] })
    },
  })
}

/** Creates a single-use invite link for the given family. */
export function useCreateFamilyInvite(familyId: string, invitedBy: string) {
  return useMutation<FamilyInvite, unknown, void>({
    mutationFn: () => createFamilyInvite(familyId, invitedBy),
  })
}
