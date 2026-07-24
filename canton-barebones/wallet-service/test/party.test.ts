import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createPartyApi } from '../src/party.ts'
import { InvalidParams } from '../src/rpc.ts'

const stubConfig = {
  port: 3010,
  corsOrigins: [],
  network: 'canton:local',
  provider: { id: 'x', version: '0.1.0' },
  canton: {
    jsonApiUrl: '',
    ledgerApiUrl: '',
    adminApiUrl: '',
    backendToken: undefined as string | undefined,
    tokenSource: 'none' as const,
  },
}

const fakePrepared = (multiHash: string) => ({
  topology: async () => ({ partyId: 'alice::fp', multiHash }),
  execute: async () => ({ partyId: 'alice::fp' }),
})

const fakeSdk = () =>
  ({
    party: {
      external: {
        create: (_pk: string) => fakePrepared('hash-1'),
      },
    },
  }) as never

describe('createPartyApi', () => {
  it('prepare rejects when publicKeyBase64 is missing', async () => {
    const api = createPartyApi(stubConfig as never, { getSdk: async () => fakeSdk() })
    await assert.rejects(
      () => api.prepare({}),
      (err) => err instanceof InvalidParams,
    )
  })

  it('prepare returns onboardingId + topology', async () => {
    const api = createPartyApi(stubConfig as never, { getSdk: async () => fakeSdk() })
    const result = (await api.prepare({ publicKeyBase64: 'pk', partyHint: 'alice' })) as Record<
      string,
      unknown
    >
    assert.ok(typeof result.onboardingId === 'string')
    assert.equal(result.partyId, 'alice::fp')
    assert.equal(result.multiHash, 'hash-1')
  })

  it('complete rejects when onboardingId is missing', async () => {
    const api = createPartyApi(stubConfig as never, { getSdk: async () => fakeSdk() })
    await assert.rejects(
      () => api.complete({ signatureBase64: 'sig' }),
      (err) => err instanceof InvalidParams,
    )
  })

  it('complete executes the prepared party-create and clears the pending entry', async () => {
    const api = createPartyApi(stubConfig as never, { getSdk: async () => fakeSdk() })
    const prep = (await api.prepare({ publicKeyBase64: 'pk', partyHint: 'alice' })) as {
      onboardingId: string
    }
    const result = await api.complete({ onboardingId: prep.onboardingId, signatureBase64: 'sig' })
    assert.deepEqual(result, { partyId: 'alice::fp' })
    assert.equal(api.pendingSize(), 0)
  })

  it('complete rejects unknown onboardingId with InvalidParams', async () => {
    const api = createPartyApi(stubConfig as never, { getSdk: async () => fakeSdk() })
    await assert.rejects(
      () => api.complete({ onboardingId: 'nope', signatureBase64: 'sig' }),
      (err) => err instanceof InvalidParams && /not found or expired/.test((err as Error).message),
    )
  })
})
