#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Encodes JWT segments in the URL-safe base64 variant required by bearer tokens.
const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

// Reads local .env values so token generation follows the same config as the stack.
const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .flatMap((line) => {
        const separator = line.indexOf('=')
        if (separator === -1) {
          return []
        }
        const key = line.slice(0, separator).trim()
        const rawValue = line.slice(separator + 1).trim()
        const value =
          (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'"))
            ? rawValue.slice(1, -1)
            : rawValue
        return [[key, value]]
      }),
  )
}

export const createCantonToken = ({ subject, audience, secret }) => {
  if (subject === undefined || subject === '') {
    throw new Error('subject is required')
  }
  if (audience === undefined || audience === '') {
    throw new Error('CANTON_AUTH_AUDIENCE is required')
  }
  if (secret === undefined || secret === '') {
    throw new Error('CANTON_AUTH_SECRET is required')
  }

  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: subject, aud: audience }
  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${b64url(signature)}`
}

// Prints a LocalNet token and the two places it can be copied for development.
const main = () => {
  const env = {
    ...parseEnvFile(path.join(root, '.env')),
    ...process.env,
  }
  const subject = process.argv[2] ?? 'ledger-api-user'
  const token = createCantonToken({
    subject,
    audience: env.CANTON_AUTH_AUDIENCE,
    secret: env.CANTON_AUTH_SECRET,
  })
  process.stdout.write(`${token}\n\n`)
  process.stdout.write('For wallet-service:\n')
  process.stdout.write(`  CANTON_BACKEND_TOKEN=${token}\n\n`)
  process.stdout.write('For Carpincho LocalNet settings:\n')
  process.stdout.write('  Use this token as the LocalNet bearer token.\n')
  process.stdout.write(
    '  You may reuse it for local dev or generate another token with this script.\n',
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
