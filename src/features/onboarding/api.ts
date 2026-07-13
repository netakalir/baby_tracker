import { supabase } from '../../lib/supabase'
import type { Child, FamilyInvite } from '../../types/database'
import type { AddChildInput, CreateFamilyInput, JoinFamilyInput } from './schemas'

const DEFAULT_FAMILY_NAME = 'המשפחה שלי'

export interface CreatedFamily {
  familyId: string
}

export async function createFamily(input: CreateFamilyInput): Promise<CreatedFamily> {
  // The family and the creator's membership are created together in a
  // single SECURITY DEFINER function (see the create_family migration).
  // One atomic call avoids both an orphaned family if the membership
  // insert were to fail, and the chicken-and-egg where the creator
  // cannot yet read back a family they are not a member of.
  const { data: familyId, error } = await supabase.rpc('create_family', {
    family_name: input.name || DEFAULT_FAMILY_NAME,
  })

  if (error) throw error

  return { familyId: familyId as string }
}

export type JoinFamilyErrorCode = 'invalid' | 'expired' | 'used' | 'already-in-family'

export class JoinFamilyError extends Error {
  code: JoinFamilyErrorCode

  constructor(code: JoinFamilyErrorCode) {
    super(code)
    this.code = code
  }
}

export async function joinFamilyByToken(userId: string, input: JoinFamilyInput): Promise<void> {
  const { data: invite, error: inviteError } = await supabase
    .from('family_invites')
    .select('*')
    .eq('token', input.token)
    .maybeSingle<FamilyInvite>()

  if (inviteError) throw inviteError
  if (!invite) throw new JoinFamilyError('invalid')
  if (invite.used_at) throw new JoinFamilyError('used')
  if (new Date(invite.expires_at) < new Date()) throw new JoinFamilyError('expired')

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (membershipLookupError) throw membershipLookupError
  if (existingMembership) throw new JoinFamilyError('already-in-family')

  // Mark the invite used first (optimistic concurrency on used_at) so two
  // people racing on the same token can't both join.
  const { data: claimedInvite, error: claimError } = await supabase
    .from('family_invites')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('id', invite.id)
    .is('used_at', null)
    .select()
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimedInvite) throw new JoinFamilyError('used')

  const { error: membershipError } = await supabase
    .from('family_members')
    .insert({ family_id: invite.family_id, user_id: userId, role: 'parent' })

  if (membershipError) throw membershipError
}

export async function addChild(familyId: string, input: AddChildInput): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .insert({ family_id: familyId, name: input.name, birth_date: input.birthDate })
    .select()
    .single<Child>()

  if (error) throw error
  return data
}
