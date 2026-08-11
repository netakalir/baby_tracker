import { test as base, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Child, Event } from '../../src/types/database'
import { adminClient } from './adminClient'
import { testEnv } from './testEnv'

/** Meets the project's 6-char minimum; the same for every fixture user. */
const TEST_PASSWORD = 'e2e-test-pw-123'

export interface TestUser {
  id: string
  email: string
  password: string
}

export interface SeededFamily {
  familyId: string
  childId: string
  childName: string
}

export interface SeedFamilyOptions {
  familyName?: string
  childName?: string
  birthDate?: string
  /** The child's day boundary ('HH:MM'). Defaults to the schema default ('00:00'). */
  dayStart?: string
  /**
   * The child's `created_at` (ISO). Defaults to now (the schema default).
   * Backdate it to seed past days the historical Today view can navigate to.
   */
  createdAt?: string
}

export interface TestFactory {
  /** Creates a pre-confirmed user (no confirmation email is sent). */
  createUser(): Promise<TestUser>
  /**
   * Seeds a family with one child, acting AS the given user through the same
   * RLS-protected paths the app uses (the `create_family` RPC + a child insert),
   * rather than bypassing RLS with the service role.
   */
  seedFamilyWithChild(user: TestUser, options?: SeedFamilyOptions): Promise<SeededFamily>
  /**
   * Creates an unused invite for a family (acting as `user`) and returns its
   * token. Defaults to expiring in 7 days; pass `expiresAt` to override (e.g. a
   * past timestamp to seed an already-expired invite).
   */
  seedInvite(user: TestUser, familyId: string, options?: { expiresAt?: string }): Promise<string>
  /**
   * Inserts events for a child, acting AS the given user (through RLS). Used to
   * seed clock state without going through the logging UI - e.g. an overnight
   * event, or a duration event that the UI cannot yet create.
   */
  seedEvents(user: TestUser, childId: string, events: SeedEvent[]): Promise<void>
  /**
   * Adds `user` as a parent of an existing family, acting AS that user through
   * RLS (the same self-insert the real invite-join flow ends with). Puts a
   * second parent in the family so cross-device / realtime paths can be tested.
   */
  addMember(user: TestUser, familyId: string): Promise<void>
}

export interface SeedEvent {
  type: Event['type']
  start_time: string
  end_time?: string | null
  metadata?: Event['metadata']
}

/**
 * Extends Playwright's `test` with a `factory` fixture. Users are created and
 * deleted through the auth-admin API (service role); all family data is seeded
 * and cleaned up as the real authenticated user, so RLS is exercised rather
 * than bypassed. Deleting a family cascades to its children, members and
 * invites (see the initial schema migration).
 */
export const test = base.extend<{ factory: TestFactory }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures with no dependencies must destructure `{}`.
  factory: async ({}, use) => {
    const createdUserIds: string[] = []
    const seededFamilies: { familyId: string; ownerId: string }[] = []
    const authedClients = new Map<string, SupabaseClient>()

    let counter = 0
    const uniqueSuffix = (): string =>
      `${Date.now()}-${counter++}-${Math.random().toString(36).slice(2, 8)}`

    async function clientFor(user: TestUser): Promise<SupabaseClient> {
      const existing = authedClients.get(user.id)
      if (existing) return existing

      const client = createClient(testEnv.supabaseUrl, testEnv.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      })
      if (error) throw error
      authedClients.set(user.id, client)
      return client
    }

    const factory: TestFactory = {
      async createUser() {
        const email = `e2e-${uniqueSuffix()}@example.com`
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password: TEST_PASSWORD,
          email_confirm: true,
        })
        if (error) throw error
        createdUserIds.push(data.user.id)
        return { id: data.user.id, email, password: TEST_PASSWORD }
      },

      async seedFamilyWithChild(user, options) {
        const client = await clientFor(user)

        const { data: familyId, error: familyError } = await client.rpc('create_family', {
          family_name: options?.familyName ?? `E2E Family ${uniqueSuffix()}`,
        })
        if (familyError) throw familyError
        seededFamilies.push({ familyId: familyId as string, ownerId: user.id })

        const { data: child, error: childError } = await client
          .from('children')
          .insert({
            family_id: familyId as string,
            name: options?.childName ?? `Baby ${uniqueSuffix()}`,
            birth_date: options?.birthDate ?? '2026-01-01',
            ...(options?.dayStart ? { day_start: options.dayStart } : {}),
            ...(options?.createdAt ? { created_at: options.createdAt } : {}),
          })
          .select('id, name')
          .single<Pick<Child, 'id' | 'name'>>()
        if (childError) throw childError

        return { familyId: familyId as string, childId: child.id, childName: child.name }
      },

      async seedInvite(user, familyId, options) {
        const client = await clientFor(user)
        const expiresAt =
          options?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await client
          .from('family_invites')
          .insert({ family_id: familyId, invited_by: user.id, expires_at: expiresAt })
          .select('token')
          .single<{ token: string }>()
        if (error) throw error
        return data.token
      },

      async seedEvents(user, childId, events) {
        const client = await clientFor(user)
        const rows = events.map((event) => ({
          child_id: childId,
          type: event.type,
          start_time: event.start_time,
          end_time: event.end_time ?? null,
          created_by: user.id,
          metadata: event.metadata ?? null,
        }))
        const { error } = await client.from('events').insert(rows)
        if (error) throw error
      },

      async addMember(user, familyId) {
        const client = await clientFor(user)
        const { error } = await client
          .from('family_members')
          .insert({ family_id: familyId, user_id: user.id, role: 'parent' })
        if (error) throw error
      },
    }

    await use(factory)

    // Delete families (cascades children/members/invites) as their owner, then
    // sign those clients out, then remove the auth users via the admin API.
    for (const { familyId, ownerId } of seededFamilies) {
      const client = authedClients.get(ownerId)
      if (!client) continue
      const { error } = await client.from('families').delete().eq('id', familyId)
      if (error) console.warn(`Cleanup: failed to delete family ${familyId}:`, error.message)
    }
    for (const client of authedClients.values()) {
      await client.auth.signOut()
    }
    for (const userId of createdUserIds) {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) console.warn(`Cleanup: failed to delete user ${userId}:`, error.message)
    }
  },
})

export { expect }
