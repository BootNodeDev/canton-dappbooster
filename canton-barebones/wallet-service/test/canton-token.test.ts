import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCantonToken } from '../src/canton-token.ts'

const b64urlDecode = (value: string): Buffer => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

describe('createCantonToken', () => {
  it('produces the same HS256 token as canton-barebones/scripts/mint-token.mjs for the pinned inputs', () => {
    // Scenario: wallet-service and the top-level token script must agree on
    // the exact LocalNet JWT shape so generated tokens work across app-user
    // Ledger, Validator, Scan, and Registry endpoints.
    const token = createCantonToken({
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })

    assert.equal(
      token,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCJ9.G9aLv-IF5X0WmIkbR10f48i-7it5LlgwpJEZ4Ce2Y-E',
    )
  })

  it('decodes to the canonical header and payload', () => {
    // Scenario: the generated bearer token must remain a simple HS256 JWT
    // with only the subject and audience claims expected by LocalNet dev auth.
    const token = createCantonToken({
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })
    const [header, payload, signature] = token.split('.')

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

  it('throws when subject is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: '', audience: 'aud', secret: 'sec' }),
      /subject is required/,
    )
  })

  it('throws when audience is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: '', secret: 'sec' }),
      /CANTON_AUTH_AUDIENCE is required/,
    )
  })

  it('throws when secret is empty', () => {
    assert.throws(
      () => createCantonToken({ subject: 'sub', audience: 'aud', secret: '' }),
      /CANTON_AUTH_SECRET is required/,
    )
  })
})
