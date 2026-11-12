import type { SupabaseClient } from '@supabase/supabase-js'
import { signInThroughApi } from '../support/authSessions'
import { expect, test, type TestFactory, type TestUser } from '../support/fixtures'

/**
 * App-tour practice children (`children.demo_owner_id`, migration
 * 20261112000000): a practice child and its events are PRIVATE to the user who
 * owns it — even the other parent of the SAME family can neither see nor touch
 * them — and `demo_owner_id` can never be set to another user or changed after
 * insert.
 *
 * Everything runs through real (anon-key) authenticated clients so RLS and the
 * immutability trigger are exercised, not bypassed.
 */
async function authedClient(user: TestUser): Promise<SupabaseClient> {
  const { client } = await signInThroughApi(user)
  return client
}

/** A family with two parents, A (owner of the seeded real child) and B. */
async function seedTwoParentFamily(factory: TestFactory) {
  const parentA = await factory.createUser()
  const family = await factory.seedFamilyWithChild(parentA)
  const parentB = await factory.createUser()
  await factory.addMember(parentB, family.familyId)
  return { parentA, parentB, familyId: family.familyId, realChildId: family.childId }
}

test.describe('practice child (app tour) RLS isolation', () => {
  test("the other parent cannot select/insert/update/delete a parent's practice child or its events", async ({
    factory,
  }) => {
    const { parentA, parentB, familyId } = await seedTwoParentFamily(factory)
    const clientA = await authedClient(parentA)
    const clientB = await authedClient(parentB)

    // A creates a practice child owned by A, and logs an event on it.
    const { data: practiceChild, error: insertPracticeError } = await clientA
      .from('children')
      .insert({
        family_id: familyId,
        name: `Practice-${Date.now()}`,
        birth_date: '2026-01-01',
        demo_owner_id: parentA.id,
      })
      .select('id')
      .single<{ id: string }>()
    expect(insertPracticeError).toBeNull()
    const practiceChildId = practiceChild!.id

    const { data: practiceEvent, error: insertEventError } = await clientA
      .from('events')
      .insert({ child_id: practiceChildId, type: 'diaper', start_time: new Date().toISOString() })
      .select('id')
      .single<{ id: string }>()
    expect(insertEventError).toBeNull()
    const practiceEventId = practiceEvent!.id

    // --- SELECT: B (same family) sees neither the practice child nor its events ---
    const { data: bSeesChild, error: bSeesChildError } = await clientB
      .from('children')
      .select('id')
      .eq('id', practiceChildId)
    expect(bSeesChildError).toBeNull()
    expect(bSeesChild).toEqual([])

    const { data: bSeesEvents, error: bSeesEventsError } = await clientB
      .from('events')
      .select('id')
      .eq('child_id', practiceChildId)
    expect(bSeesEventsError).toBeNull()
    expect(bSeesEvents).toEqual([])

    // --- INSERT: B cannot log an event on A's practice child ---
    const { error: bInsertEvent } = await clientB
      .from('events')
      .insert({ child_id: practiceChildId, type: 'mood', start_time: new Date().toISOString() })
    expect(bInsertEvent).not.toBeNull()

    // --- UPDATE: B's updates match no visible rows ---
    const { data: bUpdatedChild } = await clientB
      .from('children')
      .update({ name: 'hijacked' })
      .eq('id', practiceChildId)
      .select('id')
    expect(bUpdatedChild).toEqual([])

    const { data: bUpdatedEvent } = await clientB
      .from('events')
      .update({ type: 'mood' })
      .eq('id', practiceEventId)
      .select('id')
    expect(bUpdatedEvent).toEqual([])

    // --- DELETE: B's deletes match no visible rows ---
    const { data: bDeletedEvent } = await clientB
      .from('events')
      .delete()
      .eq('id', practiceEventId)
      .select('id')
    expect(bDeletedEvent).toEqual([])

    const { data: bDeletedChild } = await clientB
      .from('children')
      .delete()
      .eq('id', practiceChildId)
      .select('id')
    expect(bDeletedChild).toEqual([])

    // --- A keeps full per-command access to their own practice data ---
    const { data: aUpdatedChild } = await clientA
      .from('children')
      .update({ name: 'renamed practice' })
      .eq('id', practiceChildId)
      .select('id, name')
      .single()
    expect(aUpdatedChild?.name).toBe('renamed practice')

    const { data: aUpdatedEvent } = await clientA
      .from('events')
      .update({ type: 'mood' })
      .eq('id', practiceEventId)
      .select('id, type')
      .single()
    expect(aUpdatedEvent?.type).toBe('mood')

    // The tour's end-of-run sweep: deleting the practice child cascades its events.
    const { data: aDeletedChild, error: aDeleteError } = await clientA
      .from('children')
      .delete()
      .eq('demo_owner_id', parentA.id)
      .select('id')
    expect(aDeleteError).toBeNull()
    expect(aDeletedChild).toEqual([{ id: practiceChildId }])

    const { data: eventsAfterDelete } = await clientA
      .from('events')
      .select('id')
      .eq('id', practiceEventId)
    expect(eventsAfterDelete).toEqual([])

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })

  test('nobody can create, or turn a real child into, a practice child owned by someone else', async ({
    factory,
  }) => {
    const { parentA, parentB, familyId, realChildId } = await seedTwoParentFamily(factory)
    const clientA = await authedClient(parentA)
    const clientB = await authedClient(parentB)

    // --- INSERT: B cannot create a practice child owned by A ---
    const { error: bInsertForA } = await clientB.from('children').insert({
      family_id: familyId,
      name: 'planted',
      birth_date: '2026-01-01',
      demo_owner_id: parentA.id,
    })
    expect(bInsertForA).not.toBeNull()

    // --- UPDATE: B cannot flip the shared real child to a practice child owned by A ---
    const { error: bFlipToA } = await clientB
      .from('children')
      .update({ demo_owner_id: parentA.id })
      .eq('id', realChildId)
    expect(bFlipToA).not.toBeNull()

    // --- UPDATE: nor to B's own practice child (that would hide it from A) ---
    const { error: bFlipToSelf } = await clientB
      .from('children')
      .update({ demo_owner_id: parentB.id })
      .eq('id', realChildId)
    expect(bFlipToSelf).not.toBeNull()

    // The real child is still real and still visible to both parents.
    for (const client of [clientA, clientB]) {
      const { data: realChild, error } = await client
        .from('children')
        .select('id, demo_owner_id')
        .eq('id', realChildId)
        .single()
      expect(error).toBeNull()
      expect(realChild?.demo_owner_id).toBeNull()
    }

    // --- UPDATE: a practice child cannot be reassigned to another user or made real ---
    const { data: practiceChild, error: insertPracticeError } = await clientA
      .from('children')
      .insert({
        family_id: familyId,
        name: `Practice-${Date.now()}`,
        birth_date: '2026-01-01',
        demo_owner_id: parentA.id,
      })
      .select('id')
      .single<{ id: string }>()
    expect(insertPracticeError).toBeNull()

    const { error: aReassign } = await clientA
      .from('children')
      .update({ demo_owner_id: parentB.id })
      .eq('id', practiceChild!.id)
    expect(aReassign).not.toBeNull()

    const { error: aMakeReal } = await clientA
      .from('children')
      .update({ demo_owner_id: null })
      .eq('id', practiceChild!.id)
    expect(aMakeReal).not.toBeNull()

    const { data: bSeesPractice } = await clientB
      .from('children')
      .select('id')
      .eq('id', practiceChild!.id)
    expect(bSeesPractice).toEqual([])

    await clientA.auth.signOut()
    await clientB.auth.signOut()
  })
})
