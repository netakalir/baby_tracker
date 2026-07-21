/**
 * Explicit types mirroring the current Supabase schema
 * (supabase/migrations/20260701000000_initial_schema.sql).
 * Keep in sync manually until a generated-types pipeline is set up.
 */

export type FamilyMemberRole = 'parent'

export type EventType = 'sleep' | 'feeding' | 'diaper' | 'mood'

export interface Family {
  id: string
  name: string
  created_at: string
}

export type FamilyInsert = Pick<Family, 'name'>

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: FamilyMemberRole
}

export type FamilyMemberInsert = Pick<FamilyMember, 'family_id' | 'user_id' | 'role'>

export interface Child {
  id: string
  family_id: string
  name: string
  birth_date: string
  created_at: string
}

export type ChildInsert = Pick<Child, 'family_id' | 'name' | 'birth_date'>

export interface Event {
  id: string
  child_id: string
  type: EventType
  start_time: string
  end_time: string | null
  created_by: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface FamilyInvite {
  id: string
  family_id: string
  invited_by: string
  token: string
  created_at: string
  expires_at: string
  used_at: string | null
  used_by: string | null
}

export type FamilyInviteInsert = Pick<FamilyInvite, 'family_id' | 'invited_by' | 'expires_at'>
