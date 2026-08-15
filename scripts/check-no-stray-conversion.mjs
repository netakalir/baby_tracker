/**
 * Guard for unit-of-measure spec Decision 5: the ml<->oz conversion constant
 * must live ONLY in src/lib/units/index.ts. Scans all source files under src/
 * and returns the offending paths so a test can assert the list is empty.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url))
const ALLOWED = fileURLToPath(new URL('../src/lib/units/index.ts', import.meta.url))

/** Literal exact constant and the loose prefix the spec calls out. */
const FORBIDDEN = ['29.5735295625', '29.57']

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      return entry.isDirectory() ? collectFiles(path) : Promise.resolve([path])
    }),
  )
  return files.flat()
}

/** @returns {Promise<string[]>} src-relative paths that contain the constant. */
export async function findStrayConversionFiles() {
  const files = await collectFiles(SRC_DIR)
  const offenders = []
  for (const path of files) {
    if (path === ALLOWED) continue
    const contents = await readFile(path, 'utf8')
    if (FORBIDDEN.some((needle) => contents.includes(needle))) {
      offenders.push(relative(SRC_DIR, path))
    }
  }
  return offenders
}
