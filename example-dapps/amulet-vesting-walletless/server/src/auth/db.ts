// Accounts, sessions and escrow disclosures, in Postgres. The schema is `db/schema.sql`; nothing
// here creates a table.

import type { DisclosureStore } from '#server/ledger/LedgerBackend'

// What the store needs of a connection: `pg`'s Pool in the server, PGlite in the tests.
export type Sql = {
  query<R>(text: string, params?: unknown[]): Promise<{ rows: R[] }>
}

export type User = {
  id: number
  ledgerUserId: string
  partyId: string
  username: string
}

type UserRow = {
  id: number
  ledger_user_id: string
  party_id: string
  password_hash: string
  username: string
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  ledgerUserId: row.ledger_user_id,
  partyId: row.party_id,
  username: row.username,
})

export const openDb = (sql: Sql) => {
  const disclosures: DisclosureStore = {
    drop: async (contractId) => {
      await sql.query('DELETE FROM escrow_disclosures WHERE contract_id = $1', [contractId])
    },
    get: async (contractId) => {
      const { rows } = await sql.query<{ blob: string; contract_id: string; template_id: string }>(
        'SELECT * FROM escrow_disclosures WHERE contract_id = $1',
        [contractId],
      )
      const [row] = rows
      return row === undefined
        ? undefined
        : { contractId: row.contract_id, createdEventBlob: row.blob, templateId: row.template_id }
    },
    put: async (disclosed) => {
      await sql.query(
        `INSERT INTO escrow_disclosures (contract_id, template_id, blob, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (contract_id) DO UPDATE SET template_id = excluded.template_id,
           blob = excluded.blob, created_at = excluded.created_at`,
        [disclosed.contractId, disclosed.templateId, disclosed.createdEventBlob, Date.now()],
      )
    },
  }

  return {
    // Throws on a taken username: the UNIQUE constraint is the check, so two signups racing for one
    // name cannot both pass it.
    createUser: async (user: Omit<User, 'id'>, passwordHash: string): Promise<User> => {
      const { rows } = await sql.query<{ id: number }>(
        `INSERT INTO users (username, password_hash, party_id, ledger_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [user.username, passwordHash, user.partyId, user.ledgerUserId, Date.now()],
      )
      return { ...user, id: rows[0].id }
    },
    createSession: async (id: string, userId: number, expiresAt: number): Promise<void> => {
      await sql.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [
        id,
        userId,
        expiresAt,
      ])
    },
    deleteSession: async (id: string): Promise<void> => {
      await sql.query('DELETE FROM sessions WHERE id = $1', [id])
    },
    disclosures,
    purgeSessions: async (nowMs: number): Promise<void> => {
      await sql.query('DELETE FROM sessions WHERE expires_at <= $1', [nowMs])
    },
    sessionUser: async (id: string, nowMs: number): Promise<User | undefined> => {
      const { rows } = await sql.query<UserRow>(
        `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.id = $1 AND sessions.expires_at > $2`,
        [id, nowMs],
      )
      return rows[0] === undefined ? undefined : toUser(rows[0])
    },
    userByUsername: async (
      username: string,
    ): Promise<(User & { passwordHash: string }) | undefined> => {
      const { rows } = await sql.query<UserRow>('SELECT * FROM users WHERE username = $1', [
        username,
      ])
      return rows[0] === undefined
        ? undefined
        : { ...toUser(rows[0]), passwordHash: rows[0].password_hash }
    },
  }
}

export type Db = ReturnType<typeof openDb>
