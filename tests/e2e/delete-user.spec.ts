import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Event } from '../../src/types/database'
import { adminClient } from '../support/adminClient'
import { signInThroughApi } from '../support/authSessions'
import { expect, test, type TestUser } from '../support/fixtures'
import { testEnv } from '../support/testEnv'

/**
 * Account deletion through the REAL `delete-user` Edge Function on the hosted
 * project. Calling `auth.admin.deleteUser` directly would skip the function's
 * own database access, which is exactly where it once failed (migration
 * 20261123000000_grant_service_role_select_family_members.sql).
 *
 * Outcomes are read through real authenticated or anon clients. The service
 * role is used only for the auth-admin lookup, so these assertions do not
 * depend on the grant under test.
 */

async function authedClient(user: TestUser): Promise<SupabaseClient> {
  const { client } = await signInThroughApi(user)
  return client
}

/** Invokes the function as `client`, surfacing the response body on failure. */
async function deleteOwnAccount(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.functions.invoke('delete-user', { method: 'POST' })
  if (error) {
    const context: unknown = error.context
    const detail = context instanceof Response ? await context.text() : error.message
    throw new Error(`delete-user failed: ${detail}`)
  }
  expect(data).toEqual({ success: true })
}

async function expectAuthUserGone(userId: string): Promise<void> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  expect(data.user).toBeNull()
  // Any auth failure also yields a null user, so require a real "not found".
  expect(error?.status).toBe(404)
}

async function insertRunningFeeding(client: SupabaseClient, childId: string): Promise<string> {
  const { data, error } = await client
    .from('events')
    .insert({ child_id: childId, type: 'feeding', start_time: new Date().toISOString() })
    .select('id')
    .single<Pick<Event, 'id'>>()
  if (error) throw error
  return data.id
}

test.describe('delete-user Edge Function', () => {
  test('a parent leaving keeps the shared data usable by the other parent', async ({ factory }) => {
    const parentA = await factory.createUser()
    const parentB = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parentA)
    await factory.addMember(parentB, family.familyId)

    const clientA = await authedClient(parentA)
    const clientB = await authedClient(parentB)
    const runningTimerId = await insertRunningFeeding(clientB, family.childId)

    // B also owns a practice child with an event. Deleting B reaches that event
    // through two FK actions at once: the child CASCADE and created_by SET NULL.
    const { data: practiceChild, error: practiceChildError } = await clientB
      .from('children')
      .insert({
        family_id: family.familyId,
        name: `Practice-${Date.now()}`,
        birth_date: '2026-01-01',
        demo_owner_id: parentB.id,
      })
      .select('id')
      .single<{ id: string }>()
    if (practiceChildError) throw practiceChildError
    await insertRunningFeeding(clientB, practiceChild.id)

    await deleteOwnAccount(clientB)
    await expectAuthUserGone(parentB.id)

    // B's membership is gone and A's remains.
    const { data: members, error: membersError } = await clientA
      .from('family_members')
      .select('user_id')
      .eq('family_id', family.familyId)
    expect(membersError).toBeNull()
    expect(members).toEqual([{ user_id: parentA.id }])

    // A still sees the child.
    const { data: children, error: childrenError } = await clientA
      .from('children')
      .select('id')
      .eq('id', family.childId)
    expect(childrenError).toBeNull()
    expect(children).toEqual([{ id: family.childId }])

    // A still sees B's running timer, now without an author.
    const { data: orphanedEvent, error: orphanedEventError } = await clientA
      .from('events')
      .select('created_by, end_time')
      .eq('id', runningTimerId)
      .single<Pick<Event, 'created_by' | 'end_time'>>()
    expect(orphanedEventError).toBeNull()
    expect(orphanedEvent).toEqual({ created_by: null, end_time: null })

    // A can stop that timer, and the event stays authorless.
    const endTime = new Date().toISOString()
    const { data: stopped, error: stopError } = await clientA
      .from('events')
      .update({ end_time: endTime })
      .eq('id', runningTimerId)
      .select('created_by, end_time')
    expect(stopError).toBeNull()
    expect(stopped).toHaveLength(1)
    expect(stopped?.[0].created_by).toBeNull()
    expect(new Date(stopped?.[0].end_time as string).getTime()).toBe(new Date(endTime).getTime())

    // A can log a new event. Same type as the stopped timer, so this also
    // proves the one-running-timer index no longer holds the slot.
    const newEventId = await insertRunningFeeding(clientA, family.childId)
    const { data: newEvent, error: newEventError } = await clientA
      .from('events')
      .select('created_by')
      .eq('id', newEventId)
      .single<Pick<Event, 'created_by'>>()
    expect(newEventError).toBeNull()
    expect(newEvent?.created_by).toBe(parentA.id)
  })

  test('the last member leaving removes the orphaned family', async ({ factory }) => {
    const parent = await factory.createUser()
    const family = await factory.seedFamilyWithChild(parent)
    await factory.seedEvents(parent, family.childId, [
      { type: 'diaper', start_time: new Date().toISOString() },
    ])
    const inviteToken = await factory.seedInvite(parent, family.familyId)
    const client = await authedClient(parent)

    // Nobody can read a memberless family through RLS. The anon invite lookup
    // joins invites to families, so it is the observable proof of removal.
    const anonClient = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const lookUpInvite = () => anonClient.rpc('get_invite_by_token', { p_token: inviteToken })

    const { data: before, error: beforeError } = await lookUpInvite()
    expect(beforeError).toBeNull()
    expect(before).toHaveLength(1)
    expect(before?.[0].family_id).toBe(family.familyId)

    await deleteOwnAccount(client)
    await expectAuthUserGone(parent.id)

    const { data: after, error: afterError } = await lookUpInvite()
    expect(afterError).toBeNull()
    expect(after).toEqual([])
  })
})
