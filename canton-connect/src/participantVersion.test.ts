import { describe, expect, it } from 'vitest'
import { explainPagedReadFailure } from '#src/participantVersion'

const notFound = new Error('HttpMethod(POST), uri: /v2/state/active-contracts-page')

describe('explainPagedReadFailure', () => {
  it.each(['3.4.11', '3.4.0', '2.10.2'])('names the floor on a %s participant', (version) => {
    const explained = explainPagedReadFailure(notFound, { version, features: {} })

    expect(explained.message).toBe(
      `active contracts need Canton 3.5 or later and this participant runs ${version} - read /v2/state/active-contracts through ledgerApi instead`,
    )
    expect(explained.cause).toBe(notFound)
  })

  it.each(['3.5.0', '3.5.17', '3.6.0', '4.0.0'])(
    'hands the failure back untouched on a %s participant',
    (version) => {
      expect(explainPagedReadFailure(notFound, { version })).toBe(notFound)
    },
  )

  it.each([
    ['no answer', undefined],
    ['no version', {}],
    ['a version it cannot read', { version: 'main-snapshot' }],
  ])('hands the failure back untouched given %s', (_case, answer) => {
    expect(explainPagedReadFailure(notFound, answer)).toBe(notFound)
  })
})
