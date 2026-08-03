/**
 * Explicit types mirroring the current Supabase schema
 * (supabase/migrations/20260701000000_initial_schema.sql).
 * Keep in sync manually until a generated-types pipeline is set up.
 */

export type FamilyMemberRole = 'parent'

export type EventType = 'sleep' | 'feeding' | 'diaper' | 'mood'

/** How a feeding was given. Stored in a feeding event's `metadata`, not as its own event type. */
export type FeedingType = 'breast' | 'bottle'

/** The breast used, when `feeding_type` is `breast`. */
export type BreastSide = 'left' | 'right'

/**
 * Shape of a `feeding` event's `metadata`. Breast/bottle and side are details of
 * a single "feeding" event (one clock arc, one color), so they live in the jsonb
 * `metadata` rather than as new `EventType`s - no schema migration needed.
 */
export interface FeedingMetadata {
  feeding_type: FeedingType
  /** Present only when `feeding_type === 'breast'`. */
  side?: BreastSide
  /** Optional amount, mainly for bottle feeds (future expansion). */
  amount?: number
}

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
