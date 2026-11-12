import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * Authorship of an event cannot be spoofed by another member of the SAME
 * family (migration 20261112000000_enforce_events_created_by.sql):
 * - INSERT: the `created_by = auth.uid()` WITH CHECK rejects a row authored
 *   as the other parent (or as nobody), while an insert that omits
 *   `created_by` is stamped with the caller's id by the column default.
 * - UPDATE: column-level privileges make `created_by` / `created_at`
 *   non-updatable, while the columns the app does update (`end_time`,
 *   `metadata`) still work.
 *
 * Both parents are legitimate members of one family, so every rejection here
 * is about authorship, not cross-family isolation. Everything runs through
 * real (anon-key) authenticated clients so grants and RLS are exercised, not
 * bypassed.
 */

/** Postgres `insufficient_privilege`: an RLS WITH CHECK or grant denial. */
const INSUFFICIENT_PRIVILEGE = '42501'

async function authedClient(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  expect(error).toBeNull()
  return client
}

test.describe('events.created_by cannot be spoofed by another family member', () => {
  test('inserts must be authored by the caller, and authorship is immutable', async ({
    factory,
  }) => {
    const parentA = await factory.createUser()
    const parentB = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parentA)
    await factory.addMember(parentB, family.familyId)

    const clientA = await authedClient(parentA)
    const clientB = await authedClient(parentB)

    // --- INSERT as the other parent is rejected ---
    const { data: spoofedInsert, error: spoofedInsertError } = await clientA
      .from('events')
      .insert({
        child_id: family.childId,
        type: 'diaper',
        start_time: new Date().toISOString(),
        created_by: parentB.id,
      })
      .select('id')
    expect(spoofedInsert).toBeNull()
    expect(spoofedInsertError?.code).toBe(INSUFFICIENT_PRIVILEGE)

    // --- INSERT with an explicit null author is rejected too ---
    const { data: anonymousInsert, error: anonymousInsertError } = await clientA
      .from('events')
      .insert({
        child_id: family.childId,
        type: 'mood',
        start_time: new Date().toISOString(),
        created_by: null,
      })
      .select('id')
    expect(anonymousInsert).toBeNull()
    expect(anonymousInsertError?.code).toBe(INSUFFICIENT_PRIVILEGE)

    // --- A normal insert (no created_by) succeeds and is stamped as A ---
    // A running feeding timer, the same shape `startTimerEvent` inserts. The
    // child is fresh, so the one-running-timer index cannot interfere.
    const { data: inserted, error: insertError } = await clientA
      .from('events')
      .insert({
        child_id: family.childId,
        type: 'feeding',
        start_time: new Date().toISOString(),
        end_time: null,
        metadata: { feeding_type: 'bottle' },
      })
      .select('id, created_by, created_at')
      .single<{ id: string; created_by: string; created_at: string }>()
    expect(insertError).toBeNull()
    expect(inserted?.created_by).toBe(parentA.id)
    const eventId = inserted!.id
    const originalCreatedAt = inserted!.created_at

    // Sanity: B really is a member of the same family and sees A's event, so
    // the rejections below are about authorship, not visibility.
    const { data: bSeesEvent, error: bSeesEventError } = await clientB
      .from('events')
      .select('id, created_by')
      .eq('id', eventId)
      .single<{ id: string; created_by: string }>()
    expect(bSeesEventError).toBeNull()
    expect(bSeesEvent?.created_by).toBe(parentA.id)

    // --- UPDATE of created_by is denied, by the author and by the other parent ---
    for (const client of [clientA, clientB]) {
      const { data: reassigned, error: reassignError } = await client
        .from('events')
        .update({ created_by: parentB.id })
        .eq('id', eventId)
        .select('id')
      expect(reassigned).toBeNull()
      expect(reassignError?.code).toBe(INSUFFICIENT_PRIVILEGE)
    }

    // --- UPDATE of created_at is denied as well (write-once column) ---
    const { error: backdateError } = await clientA
      .from('events')
      .update({ created_at: '2020-01-01T00:00:00Z' })
      .eq('id', eventId)
      .select('id')
    expect(backdateError?.code).toBe(INSUFFICIENT_PRIVILEGE)

    // --- Regression guard: the app's stop-timer update (end_time + metadata)
    //     still works, for the author and for the other parent ---
    const { data: stopped, error: stopError } = await clientB
      .from('events')
      .update({
        end_time: new Date().toISOString(),
        metadata: { feeding_type: 'bottle', amount_ml: 120 },
      })
      .eq('id', eventId)
      .is('end_time', null)
      .select('id, end_time, metadata')
      .single<{ id: string; end_time: string | null; metadata: Record<string, unknown> }>()
    expect(stopError).toBeNull()
    expect(stopped?.end_time).not.toBeNull()
    expect(stopped?.metadata).toEqual({ feeding_type: 'bottle', amount_ml: 120 })

    const { error: authorEditError } = await clientA
      .from('events')
      .update({ metadata: { feeding_type: 'bottle', amount_ml: 150 } })
      .eq('id', eventId)
    expect(authorEditError).toBeNull()

    // --- Authorship and creation time are unchanged after everything above ---
    const { data: finalRow, error: finalRowError } = await clientA
      .from('events')
      .select('created_by, created_at')
      .eq('id', eventId)
      .single<{ created_by: string; created_at: string }>()
    expect(finalRowError).toBeNull()
    expect(finalRow?.created_by).toBe(parentA.id)
    expect(finalRow?.created_at).toBe(originalCreatedAt)

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
