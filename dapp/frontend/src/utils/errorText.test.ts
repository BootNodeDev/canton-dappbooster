import { CantonError } from '@bootnodedev/canton-connect'
import { describe, expect, it } from 'vitest'
import { errorText } from '@/utils/errorText'

describe('errorText', () => {
  it('names the participant code ahead of the cause', () => {
    const error = new CantonError({
      code: 'CONTRACT_NOT_FOUND',
      cause: 'Contract could not be found with id 00abc',
      errorCategory: 11,
    })

    expect(errorText(error)).toBe('CONTRACT_NOT_FOUND: Contract could not be found with id 00abc')
  })

  it('reads the message off any other failure', () => {
    expect(errorText(new Error('Scan unreachable'))).toBe('Scan unreachable')
  })

  it('stringifies a throw that is not an error', () => {
    expect(errorText('nope')).toBe('nope')
  })
})
