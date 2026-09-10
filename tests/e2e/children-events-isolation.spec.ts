import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * R1 (CR round 2): after splitting the `children` and `events` `for all`
 * policies into explicit per-command policies, prove cross-family isolation
 * holds for EACH command (select / insert / update / delete) at the data
 * layer — a member of family B can touch none of family A's children or
 * events, while the legitimate owner A still can.
 *
 * Everything runs through real (anon-key) authenticated clients so RLS is
 * exercised, not bypassed.
 */
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

test.describe('children & events per-command RLS isolation', () => {
  test("family B cannot select/insert/update/delete family A's children or events", async ({
    factory,
  }) => {
    const userA = await factory.createUser()
    const familyA = await factory.seedFamilyWithChild(userA, { childName: `ChildA-${Date.now()}` })
    await factory.seedEvents(userA, familyA.childId, [
      { type: 'sleep', start_time: new Date().toISOString(), end_time: null },
    ])

    const userB = await factory.createUser()
    // B needs their own family so they are a legitimate authenticated member.
    await factory.seedFamilyWithChild(userB)

    const clientA = await authedClient(userA)
    const clientB = await authedClient(userB)

    // Resolve A's seeded event id as A (who can see it).
    const { data: aEvents, error: aEventsError } = await clientA
      .from('events')
      .select('id')
      .eq('child_id', familyA.childId)
    expect(aEventsError).toBeNull()
    expect(aEvents).toHaveLength(1)
    const aEventId = aEvents![0].id as string

    // --- SELECT: B sees none of A's rows ---
    const { data: bSeesChild } = await clientB
      .from('children')
      .select('id')
      .eq('id', familyA.childId)
    expect(bSeesChild).toEqual([])

    const { data: bSeesEvent } = await clientB.from('events').select('id').eq('id', aEventId)
    expect(bSeesEvent).toEqual([])

    // --- INSERT: B cannot create a child in A's family, nor an event for A's child ---
    const { error: bInsertChild } = await clientB
      .from('children')
      .insert({ family_id: familyA.familyId, name: 'intruder', birth_date: '2026-01-01' })
    expect(bInsertChild).not.toBeNull()

    const { error: bInsertEvent } = await clientB.from('events').insert({
      child_id: familyA.childId,
      type: 'feeding',
      start_time: new Date().toISOString(),
    })
    expect(bInsertEvent).not.toBeNull()

    // --- UPDATE: B's update matches no visible rows (RLS hides them) ---
    const { data: bUpdatedChild } = await clientB
      .from('children')
      .update({ name: 'hijacked' })
      .eq('id', familyA.childId)
      .select('id')
    expect(bUpdatedChild).toEqual([])

    const { data: bUpdatedEvent } = await clientB
      .from('events')
      .update({ type: 'mood' })
      .eq('id', aEventId)
      .select('id')
    expect(bUpdatedEvent).toEqual([])

    // --- DELETE: B's delete matches no visible rows ---
    const { data: bDeletedChild } = await clientB
      .from('children')
      .delete()
      .eq('id', familyA.childId)
      .select('id')
    expect(bDeletedChild).toEqual([])

    const { data: bDeletedEvent } = await clientB
      .from('events')
      .delete()
      .eq('id', aEventId)
      .select('id')
    expect(bDeletedEvent).toEqual([])

    // --- A's row is untouched, and A retains full per-command access ---
    const { data: aChildStill } = await clientA
      .from('children')
      .select('id, name')
      .eq('id', familyA.childId)
      .single()
    expect(aChildStill?.name).toBe(familyA.childName)

    const { data: aUpdatedEvent } = await clientA
      .from('events')
      .update({ type: 'mood' })
      .eq('id', aEventId)
      .select('id, type')
      .single()
    expect(aUpdatedEvent?.type).toBe('mood')

    const { data: aDeletedEvent } = await clientA
      .from('events')
      .delete()
      .eq('id', aEventId)
      .select('id')
    expect(aDeletedEvent).toHaveLength(1)

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
