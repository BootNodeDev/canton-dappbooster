import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { decryptVault } from '@/vault/crypto'
import type { CarpinchoBackup, VaultEnvelope } from '@/vault/types'
import { useVault } from '@/vault/useVault'
import { type VaultContextValue, VaultProvider } from '@/vault/VaultContext'

const captureVault = (): { ref: { current: VaultContextValue | null } } => {
  const ref: { current: VaultContextValue | null } = { current: null }
  const Probe = (): null => {
    ref.current = useVault()
    return null
  }
  render(
    <VaultProvider>
      <Probe />
    </VaultProvider>,
  )
  return { ref }
}

describe('VaultContext.exportEncryptedVault', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('produces a carpincho-backup whose ciphertext decrypts to the account envelope', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      await ref.current?.addAccount({
        name: 'alice',
        partyId: 'alice::ns',
        network: 'localnet',
        privateKeyHex: 'aa'.repeat(32),
        publicKeyBase64: 'alice-pub',
      })
    })

    let backup: CarpinchoBackup | null = null
    await act(async () => {
      backup = (await ref.current?.exportEncryptedVault('correct-horse-battery')) ?? null
    })
    if (backup === null) {
      throw new Error('no backup produced')
    }
    assert.equal(backup.kind, 'carpincho-backup')
    assert.equal(backup.version, 1)

    const plaintext = await decryptVault('correct-horse-battery', backup.vault)
    const envelope = JSON.parse(plaintext) as VaultEnvelope
    assert.equal(envelope.v, 1)
    assert.equal(envelope.accounts.length, 1)
    assert.equal(envelope.accounts[0]?.partyId, 'alice::ns')
    assert.equal(envelope.accounts[0]?.privateKeyHex, 'aa'.repeat(32))
  })

  it('throws when the typed password is not the current vault password', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    await assert.rejects(
      () => ref.current?.exportEncryptedVault('wrong-password-here') ?? Promise.resolve(),
      /invalid password/i,
    )
  })

  it('throws when the vault is locked', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      ref.current?.lock()
    })
    await assert.rejects(
      () => ref.current?.exportEncryptedVault('correct-horse-battery') ?? Promise.resolve(),
      /vault locked/i,
    )
  })
})
