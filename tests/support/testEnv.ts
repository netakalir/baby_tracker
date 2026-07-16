import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Test configuration, read from real environment variables first and then from
 * the repo's `.env` (Supabase URL + anon key, already present for the app) and
 * `.env.test` (the service_role key, git-ignored). Keeping this separate from
 * the app's `src/lib/supabase.ts` avoids ever bundling the service_role key
 * into application code.
 */

const supportDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(supportDir, '..', '..')

function parseEnvFile(fileName: string): Record<string, string> {
  let contents: string
  try {
    contents = readFileSync(resolve(repoRoot, fileName), 'utf8')
  } catch {
    return {}
  }

  const values: Record<string, string> = {}
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    values[key] = value
  }
  return values
}

const fileEnv = { ...parseEnvFile('.env'), ...parseEnvFile('.env.test') }

function readVar(name: string): string | undefined {
  return process.env[name] ?? fileEnv[name]
}

function requireVar(name: string): string {
  const value = readVar(name)
  if (!value) {
    throw new Error(
      `Missing ${name} for E2E tests. Copy .env.test.example to .env.test and fill it in.`,
    )
  }
  return value
}

export interface TestEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  baseUrl: string
}

export const testEnv: TestEnv = {
  supabaseUrl: requireVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireVar('VITE_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: requireVar('SUPABASE_SERVICE_ROLE_KEY'),
  baseUrl: readVar('E2E_BASE_URL') ?? 'http://localhost:5173',
}
