import { supabase } from '../../lib/supabase'
import type { Child } from '../../types/database'
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

export type JoinFamilyErrorCode =
  | 'invalid'
  | 'expired'
  | 'used'
  | 'already-in-family'
  | 'family-full'

export class JoinFamilyError extends Error {
  code: JoinFamilyErrorCode

  constructor(code: JoinFamilyErrorCode) {
    super(code)
    this.code = code
  }
}

/**
 * Maps the typed errors raised by the `join_family_by_token` SECURITY DEFINER
 * function (see the harden-invite migration) to the client error codes. The DB
 * is the single source of truth: it re-validates and claims the invite and
 * creates the membership atomically, so the client only translates the result.
 */
const JOIN_ERROR_BY_DB_MESSAGE: Record<string, JoinFamilyErrorCode> = {
  invite_invalid: 'invalid',
  invite_used: 'used',
  invite_expired: 'expired',
  already_in_family: 'already-in-family',
  family_full: 'family-full',
}

export async function joinFamilyByToken(input: JoinFamilyInput): Promise<void> {
  // One atomic SECURITY DEFINER call validates the invite, marks it used, and
  // inserts the membership in a single transaction — the invite can never be
  // burned without the membership being created (the bug the old two-step
  // select→update→insert flow had), and membership can only be created for a
  // real, valid invite (no client-side INSERT policy on family_members).
  const { error } = await supabase.rpc('join_family_by_token', { p_token: input.token })

  if (error) {
    const code = JOIN_ERROR_BY_DB_MESSAGE[error.message]
    if (code) throw new JoinFamilyError(code)
    throw error
  }
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
