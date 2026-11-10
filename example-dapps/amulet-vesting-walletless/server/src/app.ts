import { randomBytes } from 'node:crypto'
import { type Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Db, User } from '#server/auth/db'
import { hashPassword, verifyPassword } from '#server/auth/password'
import { MIN_PASSWORD, type Provisioned, USERNAME } from '#server/auth/provision'
import { errorText } from '#server/domain/errorText'
import type { VestingSchedule } from '#server/domain/types'
import type { Deployment } from '#server/ledger/config'
import { LedgerBackend } from '#server/ledger/LedgerBackend'
import type { WalletFns } from '#server/ledger/wallet'
import { amount, asBody, BadRequest, optionalText, party, text } from '#server/validate'

export const SESSION_COOKIE = 'wl_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

const LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export type AppDeps = {
  cookieSecure?: boolean
  db: Db
  deployment: () => Promise<Deployment>
  ledgerFor: (user: User) => WalletFns
  now?: () => number
  provision: (username: string) => Promise<Provisioned>
}

type Env = { Variables: { user: User } }

const publicUser = (user: User) => ({ username: user.username, partyId: user.partyId })

const readJson = async (c: Context): Promise<Record<string, unknown>> => {
  try {
    return asBody(await c.req.json())
  } catch (error) {
    throw error instanceof BadRequest ? error : new BadRequest('expected a JSON body')
  }
}

// The socket, not a forwarded-for header any client can set; behind a proxy it is the proxy.
const clientOf = (c: Context): string => {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming
  return incoming?.socket?.remoteAddress ?? 'local'
}

export const createApp = ({
  cookieSecure = false,
  db,
  deployment,
  ledgerFor,
  now = Date.now,
  provision,
}: AppDeps) => {
  const app = new Hono<Env>()
  const attempts = new Map<string, { count: number; resetAt: number }>()

  const limited = (key: string): boolean => {
    const at = now()
    const entry = attempts.get(key)
    if (entry === undefined || entry.resetAt <= at) {
      attempts.set(key, { count: 1, resetAt: at + LOGIN_WINDOW_MS })
      return false
    }
    entry.count += 1
    return entry.count > LOGIN_ATTEMPTS
  }

  // Expired sessions go whenever a new one starts: no timer, so nothing has to stay running.
  const startSession = async (c: Context, user: User): Promise<void> => {
    const id = randomBytes(32).toString('base64url')
    await db.purgeSessions(now())
    await db.createSession(id, user.id, now() + SESSION_MS)
    setCookie(c, SESSION_COOKIE, id, {
      httpOnly: true,
      maxAge: SESSION_MS / 1000,
      path: '/',
      sameSite: 'Lax',
      secure: cookieSecure,
    })
  }

  const backendFor = async (user: User): Promise<LedgerBackend> =>
    new LedgerBackend(await deployment(), ledgerFor(user), db.disclosures)

  app.onError((error, c) => {
    if (error instanceof BadRequest) {
      return c.json({ error: error.message }, 400)
    }
    console.error(error)
    return c.json({ error: errorText(error) }, 502 as ContentfulStatusCode)
  })

  // A cross-site form cannot post JSON without a preflight, so requiring it is the CSRF check.
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'GET' && !c.req.header('content-type')?.startsWith('application/json')) {
      return c.json({ error: 'expected content-type: application/json' }, 415)
    }
    await next()
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  app.post('/api/auth/signup', async (c) => {
    const body = await readJson(c)
    const username = text(body, 'username', 32).toLowerCase()
    const password = text(body, 'password', 256)
    if (!USERNAME.test(username)) {
      throw new BadRequest(
        'username must be 3–32 characters: lowercase letters, digits and dashes, not starting with a dash',
      )
    }
    if (password.length < MIN_PASSWORD) {
      throw new BadRequest(`password must be at least ${MIN_PASSWORD} characters`)
    }
    if (limited(`signup:${clientOf(c)}`)) {
      return c.json({ error: 'too many attempts, try again later' }, 429)
    }
    if ((await db.userByUsername(username)) !== undefined) {
      return c.json({ error: 'that username is taken' }, 409)
    }
    const passwordHash = await hashPassword(password)
    const provisioned = await provision(username)
    let user: User
    try {
      user = await db.createUser({ username, ...provisioned }, passwordHash)
    } catch {
      // Lost a race for the name. The new party stays on the ledger, unused and harmless.
      console.warn(`orphaned party ${provisioned.partyId} after a signup race for ${username}`)
      return c.json({ error: 'that username is taken' }, 409)
    }
    await startSession(c, user)
    return c.json(publicUser(user), 201)
  })

  app.post('/api/auth/login', async (c) => {
    const body = await readJson(c)
    const username = text(body, 'username', 32).toLowerCase()
    const password = text(body, 'password', 256)
    if (limited(`login:${clientOf(c)}:${username}`)) {
      return c.json({ error: 'too many attempts, try again later' }, 429)
    }
    const found = await db.userByUsername(username)
    if (found === undefined || !(await verifyPassword(password, found.passwordHash))) {
      return c.json({ error: 'wrong username or password' }, 401)
    }
    attempts.delete(`login:${clientOf(c)}:${username}`)
    const { passwordHash: _, ...user } = found
    await startSession(c, user)
    return c.json(publicUser(user))
  })

  app.post('/api/auth/logout', async (c) => {
    const id = getCookie(c, SESSION_COOKIE)
    if (id !== undefined) {
      await db.deleteSession(id)
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.get('/api/status', async (c) => {
    try {
      await deployment()
      return c.json({ ready: true })
    } catch (error) {
      return c.json({ ready: false, error: errorText(error) })
    }
  })

  // ── Everything below needs a session ───────────────────────────────────────

  app.use('/api/*', async (c, next) => {
    const id = getCookie(c, SESSION_COOKIE)
    const user = id === undefined ? undefined : await db.sessionUser(id, now())
    if (user === undefined) {
      return c.json({ error: 'not signed in' }, 401)
    }
    c.set('user', user)
    await next()
  })

  app.get('/api/session', (c) => c.json(publicUser(c.var.user)))

  app.get('/api/users/:username', async (c) => {
    const found = await db.userByUsername(c.req.param('username').toLowerCase())
    return found === undefined
      ? c.json({ error: 'no such user' }, 404)
      : c.json({ username: found.username, partyId: found.partyId })
  })

  app.get('/api/vesting', async (c) => {
    const user = c.var.user
    return c.json(await (await backendFor(user)).viewAs(user.partyId))
  })

  app.get('/api/grants/:cid/claims', async (c) => {
    const user = c.var.user
    return c.json(await (await backendFor(user)).claimHistory(user.partyId, c.req.param('cid')))
  })

  app.get('/api/balance', async (c) => {
    const user = c.var.user
    return c.json({ free: await (await backendFor(user)).balanceOf(user.partyId) })
  })

  app.post('/api/grants', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor(user)).createVesting(user.partyId, {
      receiver: party(body, 'receiver'),
      totalAmount: amount(body, 'totalAmount'),
      // Shape only: the Daml model checks what the curve means, and refuses one that makes none.
      schedule: asBody(body.schedule) as unknown as VestingSchedule,
      title: text(body, 'title', 200),
      note: optionalText(body, 'note', 2000),
    })
    return c.json({ ok: true }, 201)
  })

  app.post('/api/proposals/:cid/accept', async (c) => {
    const user = c.var.user
    await (await backendFor(user)).accept({
      receiver: user.partyId,
      pendingCid: c.req.param('cid'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/grants/:cid/withdraw', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor(user)).withdraw({
      receiver: user.partyId,
      contractCid: c.req.param('cid'),
      amount: amount(body, 'amount'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/grants/:cid/cancel', async (c) => {
    const user = c.var.user
    await (await backendFor(user)).cancel({
      creator: user.partyId,
      contractCid: c.req.param('cid'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/claims/:cid/withdraw', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor(user)).claimResidual({
      receiver: user.partyId,
      claimCid: c.req.param('cid'),
      amount: amount(body, 'amount'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/tap', async (c) => {
    const user = c.var.user
    await (await backendFor(user)).tap(user.partyId)
    return c.json({ ok: true })
  })

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  return app
}
