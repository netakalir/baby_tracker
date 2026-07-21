import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Child } from '../../types/database'
import { useAuth } from '../auth/useAuth'

export type OnboardingStatus = 'no-family' | 'no-child' | 'ready'

export interface OnboardingState {
  status: OnboardingStatus
  familyId: string | null
  firstChild: Child | null
}

async function fetchOnboardingState(userId: string): Promise<OnboardingState> {
  const { data: membership, error: membershipError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipError) throw membershipError

  if (!membership) {
    return { status: 'no-family', familyId: null, firstChild: null }
  }

  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', membership.family_id)
    .order('created_at', { ascending: true })
    .limit(1)

  if (childrenError) throw childrenError

  const firstChild = (children?.[0] as Child | undefined) ?? null

  return {
    status: firstChild ? 'ready' : 'no-child',
    familyId: membership.family_id,
    firstChild,
  }
}

export function useOnboardingStatus() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['onboarding-status', user?.id],
    queryFn: () => fetchOnboardingState(user!.id),
    enabled: Boolean(user),
  })
}
