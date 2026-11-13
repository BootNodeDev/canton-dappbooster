import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto'

const COST = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) =>
      error === null ? resolve(key) : reject(error),
    )
  })

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST)
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join(
    '$',
  )
}

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const [scheme, N, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || salt === undefined || hash === undefined) {
    return false
  }
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return key.length === expected.length && timingSafeEqual(key, expected)
}
