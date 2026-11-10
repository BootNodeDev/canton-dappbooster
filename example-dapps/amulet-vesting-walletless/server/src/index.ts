import { serve } from '@hono/node-server'
import pg from 'pg'
import { createApp } from '#server/app'
import { openDb } from '#server/auth/db'
import { provisionParty } from '#server/auth/provision'
import { COOKIE_SECURE, DATABASE_URL, PORT } from '#server/env'
import { ledgerClient } from '#server/ledger/client'
import { authenticatedUser, loadBackendConfig } from '#server/ledger/config'
import { adminToken } from '#server/ledger/token'

const db = openDb(new pg.Pool({ connectionString: DATABASE_URL }))
// Not kept on failure, so a bootstrap run after the server started counts on the next request.
const keptOnceLoaded = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let kept: Promise<T> | undefined
  return () => {
    kept ??= load().catch((error: unknown) => {
      kept = undefined
      throw error
    })
    return kept
  }
}

const admin = ledgerClient({ token: adminToken, userId: () => serviceUser() })
const serviceUser = keptOnceLoaded(() => authenticatedUser(admin.ledgerApi))
const currentDeployment = keptOnceLoaded(() => loadBackendConfig(admin.ledgerApi))

const app = createApp({
  cookieSecure: COOKIE_SECURE,
  db,
  deployment: currentDeployment,
  ledgerFor: () => admin,
  provision: async (username) => provisionParty(admin.ledgerApi, await serviceUser(), username),
})

serve({ fetch: app.fetch, hostname: 'localhost', port: PORT }, (info) => {
  console.log(
    `wallet-less server on http://localhost:${info.port} (db ${new URL(DATABASE_URL).host})`,
  )
  currentDeployment().then(
    (found) => console.log(`vesting deployment: package ${found.pkg}`),
    (error: unknown) => console.warn(`vesting deployment not found yet: ${String(error)}`),
  )
})
