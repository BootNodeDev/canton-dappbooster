import { randomBytes } from 'node:crypto'
import { type Context, Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Db, User } from '#server/auth/db'
import { hashPassword, verifyPassword } from '#server/auth/password'
import { MIN_PASSWORD, USERNAME } from '#server/auth/provision'
import { errorText } from '#server/domain/errorText'
import type { Account, Balance, ServerStatus } from '#server/domain/types'
import type { Deployment } from '#server/ledger/config'
import { LedgerBackend } from '#server/ledger/LedgerBackend'
import type { WalletFns } from '#server/ledger/wallet'
import { amount, asBody, BadRequest, optionalText, party, schedule, text } from '#server/validate'

export const SESSION_COOKIE = 'wl_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const UNIQUE_VIOLATION = '23505'

export type AppDeps = {
  accountTtlHours?: number
  cookieSecure?: boolean
  db: Db
  deployment: () => Promise<Deployment>
  ledger: WalletFns
  limitWindowMinutes?: number
  loginLimit?: number
  maxAccounts?: number
  now?: () => number
  provision: (username: string) => Promise<string>
  release: (partyIds: string[]) => Promise<void>
  signupLimit?: number
}

type Env = { Variables: { user: User } }

const publicUser = (user: User): Account => ({ username: user.username, partyId: user.partyId })

const readJson = async (c: Context): Promise<Record<string, unknown>> =>
  asBody(
    await c.req.json().catch(() => {
      throw new BadRequest('expected a JSON body')
    }),
  )

const waitText = (ms: number): string => {
  const minutes = Math.ceil(ms / MINUTE_MS)
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  return `${Math.ceil(minutes / 60)} hours`
}

export const createApp = ({
  accountTtlHours = 0,
  cookieSecure = false,
  db,
  deployment,
  ledger,
  limitWindowMinutes = 10,
  loginLimit = 10,
  maxAccounts = 0,
  now = Date.now,
  provision,
  release,
  signupLimit = 10,
}: AppDeps) => {
  const app = new Hono<Env>()
  const limitWindowMs = limitWindowMinutes * MINUTE_MS
  const attempts = new Map<string, { count: number; resetAt: number }>()

  // Keyed on nothing the client sends: a proxy in front can pass a forwarded address it wrote.
  const retryAfter = (key: string, max: number, windowMs: number): number => {
    const at = now()
    const entry = attempts.get(key)
    if (entry === undefined || entry.resetAt <= at) {
      for (const [stale, { resetAt }] of attempts) {
        if (resetAt <= at) attempts.delete(stale)
      }
      attempts.set(key, { count: 1, resetAt: at + windowMs })
      return 0
    }
    entry.count += 1
    return entry.count > max ? entry.resetAt - at : 0
  }

  // The right goes first: a row deleted with its right still granted holds a slot nothing frees.
  const expireAccounts = async (): Promise<void> => {
    if (accountTtlHours === 0) return
    const before = now() - accountTtlHours * HOUR_MS
    const expired = await db.usersCreatedBefore(before)
    if (expired.length > 0) {
      await release(expired.map((user) => user.partyId))
      await db.deleteUsers(expired.map((user) => user.id))
    }
    await db.purgeDisclosures(before)
  }

  const waitForRoom = async (): Promise<number | undefined> => {
    if (maxAccounts === 0) return undefined
    const { count, oldestCreatedAt } = await db.accountCount()
    if (count < maxAccounts) return undefined
    return accountTtlHours === 0 || oldestCreatedAt === undefined
      ? 0
      : oldestCreatedAt + accountTtlHours * HOUR_MS - now()
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

  const backendFor = async (): Promise<LedgerBackend> =>
    new LedgerBackend(await deployment(), ledger, db.disclosures)

  app.onError((error, c) => {
    if (error instanceof BadRequest) {
      return c.json({ error: error.message }, 400)
    }
    console.error(error)
    return c.json({ error: errorText(error) }, 502)
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
    const busy = retryAfter('signup', signupLimit, limitWindowMs)
    if (busy > 0) {
      return c.json(
        { error: `too many new accounts right now, try again in ${waitText(busy)}` },
        429,
      )
    }
    await expireAccounts()
    if ((await db.userByUsername(username)) !== undefined) {
      return c.json({ error: 'that username is taken' }, 409)
    }
    const full = await waitForRoom()
    if (full !== undefined) {
      const error =
        full > 0
          ? `no room for new accounts, try again in ${waitText(full)}`
          : 'no room for new accounts'
      return c.json({ error }, 503)
    }
    const passwordHash = await hashPassword(password)
    const partyId = await provision(username)
    let user: User
    try {
      user = await db.createUser({ username, partyId }, passwordHash)
    } catch (error) {
      if ((error as { code?: unknown }).code !== UNIQUE_VIOLATION) throw error
      // Lost a race for the name. The new party stays on the ledger, unused and harmless.
      console.warn(`orphaned party ${partyId} after a signup race for ${username}`)
      return c.json({ error: 'that username is taken' }, 409)
    }
    await startSession(c, user)
    return c.json(publicUser(user), 201)
  })

  app.post('/api/auth/login', async (c) => {
    const body = await readJson(c)
    const username = text(body, 'username', 32).toLowerCase()
    const password = text(body, 'password', 256)
    const key = `login:${username}`
    const locked = retryAfter(key, loginLimit, limitWindowMs)
    if (locked > 0) {
      return c.json(
        { error: `too many failed sign-ins for ${username}, try again in ${waitText(locked)}` },
        429,
      )
    }
    const found = await db.userByUsername(username)
    if (found === undefined || !(await verifyPassword(password, found.passwordHash))) {
      return c.json({ error: 'wrong username or password' }, 401)
    }
    attempts.delete(key)
    await startSession(c, found)
    return c.json(publicUser(found))
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
      return c.json({ accountTtlHours, ready: true } satisfies ServerStatus)
    } catch (error) {
      return c.json({
        accountTtlHours,
        ready: false,
        error: errorText(error),
      } satisfies ServerStatus)
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
    return found === undefined ? c.json({ error: 'no such user' }, 404) : c.json(publicUser(found))
  })

  app.get('/api/vesting', async (c) => {
    const user = c.var.user
    return c.json(await (await backendFor()).viewAs(user.partyId))
  })

  app.get('/api/grants/:cid/claims', async (c) => {
    const user = c.var.user
    return c.json(await (await backendFor()).claimHistory(user.partyId, c.req.param('cid')))
  })

  app.get('/api/balance', async (c) => {
    const user = c.var.user
    return c.json({ free: await (await backendFor()).balanceOf(user.partyId) } satisfies Balance)
  })

  app.post('/api/grants', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor()).createVesting(user.partyId, {
      receiver: party(body, 'receiver'),
      totalAmount: amount(body, 'totalAmount'),
      schedule: schedule(body, 'schedule'),
      title: text(body, 'title', 200),
      note: optionalText(body, 'note', 2000),
    })
    return c.json({ ok: true }, 201)
  })

  app.post('/api/proposals/:cid/accept', async (c) => {
    const user = c.var.user
    await (await backendFor()).accept({
      receiver: user.partyId,
      pendingCid: c.req.param('cid'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/grants/:cid/withdraw', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor()).withdraw({
      receiver: user.partyId,
      contractCid: c.req.param('cid'),
      amount: amount(body, 'amount'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/grants/:cid/cancel', async (c) => {
    const user = c.var.user
    await (await backendFor()).cancel({
      creator: user.partyId,
      contractCid: c.req.param('cid'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/claims/:cid/withdraw', async (c) => {
    const user = c.var.user
    const body = await readJson(c)
    await (await backendFor()).claimResidual({
      receiver: user.partyId,
      claimCid: c.req.param('cid'),
      amount: amount(body, 'amount'),
    })
    return c.json({ ok: true })
  })

  app.post('/api/tap', async (c) => {
    const user = c.var.user
    await (await backendFor()).tap(user.partyId)
    return c.json({ ok: true })
  })

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  return app
}
