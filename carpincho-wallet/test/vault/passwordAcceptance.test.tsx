import { strict as assert } from 'node:assert'
import { afterEach, test } from 'node:test'
import { cleanup, render, waitFor } from '@testing-library/react'
import { isPasswordAcceptable, usePasswordStrengthReady } from '@/vault/passwordStrength'

const Probe = (): JSX.Element => (
  <span data-testid="ready">{usePasswordStrengthReady() ? 'ready' : 'loading'}</span>
)

afterEach(() => {
  cleanup()
})

test('accepts a short password once it meets the strength score', async () => {
  const { getByTestId } = render(<Probe />)
  // Lazy zxcvbn dictionary load can exceed waitFor's 1s default under full-suite load.
  await waitFor(() => assert.equal(getByTestId('ready').textContent, 'ready'), { timeout: 5000 })
  // 8 chars (under the former 9-char floor) but scores 1, the default minimum.
  assert.equal(isPasswordAcceptable('monkey99'), true)
})
