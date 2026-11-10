import { readFileSync } from 'node:fs'
import pg from 'pg'
import { DATABASE_URL } from '#server/env'

const schema = readFileSync(new URL('schema.sql', import.meta.url), 'utf8')
const client = new pg.Client({ connectionString: DATABASE_URL })

await client.connect()
try {
  // No parameters, so this goes as one simple query, which may hold several statements.
  await client.query(schema)
  console.log(`schema applied to ${new URL(DATABASE_URL).host}`)
} finally {
  await client.end()
}
