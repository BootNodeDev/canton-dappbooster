import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createCantonToken } from '../scripts/mint-token.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptPath = path.resolve(__dirname, '../scripts/mint-token.mjs')

const b64urlDecode = (value) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

describe('Canton token generation', () => {
  it('creates the HS256 JWT Splice LocalNet accepts for local auth', () => {
    // Scenario: Splice LocalNet services share the unsafe local JWT recipe.
    // The generated token is what operators paste into wallet-service or
    // Carpincho dev settings, while the signing secret stays in .env.
    const token = createCantonToken({
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })
    const [header, payload, signature] = token.split('.')

    assert.equal(
      token,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCJ9.G9aLv-IF5X0WmIkbR10f48i-7it5LlgwpJEZ4Ce2Y-E',
    )
    assert.deepEqual(JSON.parse(b64urlDecode(header).toString('utf8')), {
      alg: 'HS256',
      typ: 'JWT',
    })
    assert.deepEqual(JSON.parse(b64urlDecode(payload).toString('utf8')), {
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
    })
    assert.equal(signature.length, 43)
  })

  it('prints the default-subject token and the LocalNet copy-paste instructions', () => {
    // Scenario: the script is the single supported way to derive dev JWTs from
    // the local signing recipe; it must tell operators where to use the
    // generated token without mutating .env or leaking the signing secret.
    const output = execFileSync(process.execPath, [scriptPath], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        CANTON_AUTH_AUDIENCE: 'https://canton.network.global',
        CANTON_AUTH_SECRET: 'unsafe',
      },
      encoding: 'utf8',
    })

    assert.match(output, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
    assert.match(output, /CANTON_BACKEND_TOKEN=/)
    assert.match(output, /Carpincho LocalNet settings/)
  })
})
