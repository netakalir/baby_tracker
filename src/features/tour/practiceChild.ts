import { supabase } from '../../lib/supabase'
import type { Child } from '../../types/database'

/**
 * The tour's practice child: a temporary row in `children`, owned by one user
 * (`demo_owner_id`), that the tour logs real events against. RLS keeps it - and
 * its events - visible to its owner only, and deleting it removes its events
 * with it (`on delete cascade`). This is "flagged demo data in the same
 * database": the tour exercises the real screens and queries, while the family's
 * real data is never touched.
 */

/** The name shown in the header while practising. */
export const PRACTICE_CHILD_NAME = 'תינוק תרגול'

interface CreatePracticeChildInput {
  readonly familyId: string
  readonly ownerId: string
  /**
   * Copied from the real child, so anything age-based behaves as it will for
   * the parent's own baby.
   */
  readonly birthDate: string
  readonly dayStart: string
}

/**
 * Removes the user's practice children (normally at most one). Run when a tour
 * ends, and before a new one starts, so a tour abandoned midway (app closed,
 * network lost) leaves nothing behind for long.
 */
export async function deleteOwnPracticeChildren(ownerId: string): Promise<void> {
  const { error } = await supabase.from('children').delete().eq('demo_owner_id', ownerId)
  if (error) throw error
}

/**
 * Removes one specific practice child. Used where a tour is abandoned, so a
 * newer tour started meanwhile keeps its own practice child. RLS lets a user
 * delete only their own practice child; the filter on `demo_owner_id` also
 * guarantees this can never touch a real child.
 */
export async function deletePracticeChild(childId: string): Promise<void> {
  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', childId)
    .not('demo_owner_id', 'is', null)
  if (error) throw error
}

/** Creates a fresh practice child, replacing any left over from an earlier tour. */
export async function createPracticeChild(input: CreatePracticeChildInput): Promise<Child> {
  await deleteOwnPracticeChildren(input.ownerId)

  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: input.familyId,
      name: PRACTICE_CHILD_NAME,
      birth_date: input.birthDate,
      day_start: input.dayStart,
      demo_owner_id: input.ownerId,
    })
    .select()
    .single<Child>()

  if (error) throw error
  return data
}
