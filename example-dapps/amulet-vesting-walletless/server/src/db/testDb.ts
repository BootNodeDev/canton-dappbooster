// A real Postgres for the tests, in-process: PGlite answers `query` the way `pg` does, so the store
// runs unchanged on it, and no test needs Docker.

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const schema = readFileSync(new URL('schema.sql', import.meta.url), 'utf8')

export const testDb = async (): Promise<PGlite> => {
  const db = new PGlite()
  await db.exec(schema)
  return db
}
