import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const schema = readFileSync(new URL('schema.sql', import.meta.url), 'utf8')

// One per test file, as vitest isolates each file's modules; one per test outran the hook timeout.
let booted: Promise<PGlite> | undefined

export const testDb = async (): Promise<PGlite> => {
  booted ??= PGlite.create().then(async (db) => {
    await db.exec(schema)
    return db
  })
  const db = await booted
  await db.exec('TRUNCATE users, sessions, escrow_disclosures RESTART IDENTITY CASCADE')
  return db
}
