import { serve } from '@hono/node-server'
import pg from 'pg'
import { createApp } from '#server/app'
import { openDb } from '#server/auth/db'
import { provisionParty } from '#server/auth/provision'
import { ADMIN_USER, COOKIE_SECURE, DATABASE_URL, PORT } from '#server/env'
import { ledgerClient } from '#server/ledger/client'
import { type Deployment, loadBackendConfig } from '#server/ledger/config'
import { adminToken } from '#server/ledger/token'

const db = openDb(new pg.Pool({ connectionString: DATABASE_URL }))
// One participant user allocates parties, holds the operator and acts as every signup's party.
const admin = ledgerClient({ token: adminToken, userId: ADMIN_USER })

let deployment: Promise<Deployment> | undefined
// A failure is not kept, so a bootstrap run after the server started counts on the next request.
const currentDeployment = (): Promise<Deployment> => {
  deployment ??= loadBackendConfig(admin.ledgerApi).catch((error: unknown) => {
    deployment = undefined
    throw error
  })
  return deployment
}

const app = createApp({
  cookieSecure: COOKIE_SECURE,
  db,
  deployment: currentDeployment,
  ledgerFor: () => admin,
  provision: (username) => provisionParty(admin.ledgerApi, ADMIN_USER, username),
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
