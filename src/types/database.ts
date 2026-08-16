/**
 * Explicit types mirroring the current Supabase schema
 * (supabase/migrations/20260701000000_initial_schema.sql).
 * Keep in sync manually until a generated-types pipeline is set up.
 */

import type { FeedingAmount } from '../lib/units'

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
  /**
   * Canonical amount in millilitres (integer), the single source of truth for all
   * math/aggregation. Present mainly for bottle feeds. See the unit-of-measure spec.
   */
  amount_ml?: number
  /**
   * What the user actually entered, preserved verbatim (source fidelity) so the
   * entering unit is displayed without conversion drift.
   */
  entered?: FeedingAmount['entered']
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

/**
 * A family member enriched with their real identity (display name + email),
 * returned by the `family_members_with_identity` RPC. Plain RLS on
 * `family_members` exposes only `user_id` + `role`; the SECURITY DEFINER RPC
 * additionally joins `auth.users` and `user_preferences` so the other parent's
 * name/email can be shown (see the RPC migration). `display_name` is null when
 * that member has not set one yet.
 */
export interface FamilyMemberIdentity {
  id: string
  user_id: string
  role: FamilyMemberRole
  display_name: string | null
  email: string | null
}

export interface Child {
  id: string
  family_id: string
  name: string
  birth_date: string
  /**
   * Per-child day boundary ('HH:MM[:SS]'), default '00:00'. Decides which events
   * count as "today" for this child. Stored here (not per-user/per-family) because
   * it is a fact about the baby's routine — see the CLAUDE.md timezone principle.
   * Not applied to the clock yet (deferred "apply" layer).
   */
  day_start: string
  created_at: string
}

export type ChildInsert = Pick<Child, 'family_id' | 'name' | 'birth_date'>

export interface Event {
  id: string
  child_id: string
  type: EventType
  start_time: string
  end_time: string | null
  /**
   * The user who logged the event. Nullable because account deletion ("leave
   * only", spec §6) relaxes this FK to `ON DELETE SET NULL`: the shared event
   * survives the author's account deletion, just without an author link.
   */
  created_by: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface FamilyInvite {
  id: string
  family_id: string
  /**
   * The user who created the invite. Nullable because account deletion relaxes
   * this FK to `ON DELETE SET NULL` (see `created_by` on `Event`).
   */
  invited_by: string | null
  token: string
  created_at: string
  expires_at: string
  used_at: string | null
  used_by: string | null
}

export type FamilyInviteInsert = Pick<FamilyInvite, 'family_id' | 'invited_by' | 'expires_at'>

export type AppLanguage = 'he' | 'en'

export type AppTheme = 'light' | 'dark' | 'system'

export type MeasurementUnit = 'ml' | 'oz'

/**
 * Per-user settings (user_preferences migrations).
 * One row per auth user; never shared with the other parent.
 *
 * `units` lives here (not in family_settings): amounts are stored canonically
 * in millilitres, so ml <-> oz is a lossless per-viewer display choice, exactly
 * like the UTC-store / local-display timezone principle (see the
 * 20260804000000_move_units_to_user_preferences migration).
 */
export interface UserPreferences {
  user_id: string
  display_name: string | null
  language: AppLanguage
  theme: AppTheme
  units: MeasurementUnit
  notif_feeding: boolean
  notif_sleep: boolean
  notif_daily_summary: boolean
  updated_at: string
}

export type UserPreferencesUpsert = Pick<
  UserPreferences,
  | 'user_id'
  | 'display_name'
  | 'language'
  | 'theme'
  | 'units'
  | 'notif_feeding'
  | 'notif_sleep'
  | 'notif_daily_summary'
>

/**
 * Per-family settings (family_settings migrations).
 *
 * Deliberately empty placeholder: `units` moved to user_preferences (per-user)
 * and `day_start` moved to children (per-child), leaving no genuinely per-family
 * setting. The table is kept (not dropped) as a home for a future family-scoped
 * setting, so this interface currently holds only its key + audit column.
 */
export interface FamilySettings {
  family_id: string
  updated_at: string
}

export type FamilySettingsUpsert = Pick<FamilySettings, 'family_id'>
