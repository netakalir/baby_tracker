/**
 * Guard for unit-of-measure spec Decision 5: the ml<->oz conversion constant
 * must live ONLY in src/lib/units/index.ts. Scans all source files under src/
 * and returns the offending paths so a test can assert the list is empty.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url))
// The module that legitimately owns the constant, plus this guard itself
// (its FORBIDDEN list necessarily contains the literal it hunts for).
const ALLOWED = new Set([
  fileURLToPath(new URL('./index.ts', import.meta.url)),
  fileURLToPath(new URL('./checkNoStrayConversion.ts', import.meta.url)),
])

/** Literal exact constant and the loose prefix the spec calls out. */
const FORBIDDEN = ['29.5735295625', '29.57']

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? collectFiles(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

/** @returns src-relative paths that contain the forbidden conversion constant. */
export async function findStrayConversionFiles(): Promise<string[]> {
  const files = await collectFiles(SRC_DIR)
  const offenders: string[] = []
  for (const path of files) {
    if (ALLOWED.has(path)) continue
    const contents = await readFile(path, 'utf8')
    if (FORBIDDEN.some((needle) => contents.includes(needle))) {
      offenders.push(relative(SRC_DIR, path))
    }
  }
  return offenders
}
