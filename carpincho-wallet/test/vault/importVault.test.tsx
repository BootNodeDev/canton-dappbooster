import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { wrapBackup } from '@/vault/backup'
import { encryptVault } from '@/vault/crypto'
import { generateKeypair } from '@/vault/keypair'
import type { CarpinchoBackup, ImportVaultResult, VaultEnvelope } from '@/vault/types'
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

const SOURCE_PW = 'staple-galaxy-printer'
const DEST_PW = 'correct-horse-battery'

const makeBackup = async (
  password: string,
  accounts: VaultEnvelope['accounts'],
): Promise<CarpinchoBackup> =>
  wrapBackup(await encryptVault(password, JSON.stringify({ v: 1, accounts })))

describe('VaultContext.importEncryptedVault', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('decrypts with the file password and merges, re-persisting under the destination vault password', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })

    let result: ImportVaultResult | undefined
    await act(async () => {
      result = await ref.current?.importEncryptedVault(backup, SOURCE_PW)
    })
    assert.deepEqual(result, { imported: 1, skipped: 0, rejected: 0 })

    // Proves re-encryption under the destination password: lock, then unlock with it.
    await act(async () => {
      ref.current?.lock()
    })
    await act(async () => {
      await ref.current?.unlock(DEST_PW)
    })
    assert.equal(ref.current?.accounts.find((a) => a.name === 'alice')?.partyId, 'alice::ns')
  })

  it('rejects a wrong file password', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await assert.rejects(
      () => ref.current?.importEncryptedVault(backup, 'totally-wrong-pw') ?? Promise.resolve(),
      /wrong password for this file/i,
    )
  })

  it('rejects a tampered ciphertext as a wrong password', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const head = backup.vault.cipher.data[0] === 'A' ? 'B' : 'A'
    const tampered: CarpinchoBackup = {
      ...backup,
      vault: {
        ...backup.vault,
        cipher: { ...backup.vault.cipher, data: head + backup.vault.cipher.data.slice(1) },
      },
    }
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await assert.rejects(
      () => ref.current?.importEncryptedVault(tampered, SOURCE_PW) ?? Promise.resolve(),
      /wrong password for this file/i,
    )
  })

  it('rejects a raw EncryptedVault (no backup marker)', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await assert.rejects(
      () => ref.current?.importEncryptedVault(backup.vault, SOURCE_PW) ?? Promise.resolve(),
      /isn't a Carpincho backup/i,
    )
  })

  it('rejects an unsupported container version', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await assert.rejects(
      () =>
        ref.current?.importEncryptedVault({ ...backup, version: 2 }, SOURCE_PW) ??
        Promise.resolve(),
      /isn't a Carpincho backup/i,
    )
  })

  it('still applies per-entry validation after decryption', async () => {
    const good = await generateKeypair()
    const bad = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: good.publicKeyBase64,
        privateKeyHex: good.privateKeyHex,
        network: 'devnet',
      },
      {
        name: 'eve',
        partyId: 'eve::ns',
        publicKeyBase64: 'not-the-matching-key',
        privateKeyHex: bad.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    let result: ImportVaultResult | undefined
    await act(async () => {
      result = await ref.current?.importEncryptedVault(backup, SOURCE_PW)
    })
    assert.deepEqual(result, { imported: 1, skipped: 0, rejected: 1 })
  })

  it('propagates an unsupported inner envelope version', async () => {
    const backup = wrapBackup(await encryptVault(SOURCE_PW, JSON.stringify({ v: 2, accounts: [] })))
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await assert.rejects(
      () => ref.current?.importEncryptedVault(backup, SOURCE_PW) ?? Promise.resolve(),
      /unsupported vault envelope/i,
    )
  })

  it('counts dedupe-skip and malformed-partyId reject independently', async () => {
    const alice = await generateKeypair()
    const dupe = await generateKeypair()
    const bob = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: alice.publicKeyBase64,
        privateKeyHex: alice.privateKeyHex,
        network: 'devnet',
      },
      {
        name: 'alice-dupe',
        partyId: 'alice::ns',
        publicKeyBase64: dupe.publicKeyBase64,
        privateKeyHex: dupe.privateKeyHex,
        network: 'devnet',
      },
      {
        name: 'bob',
        partyId: 'bob',
        publicKeyBase64: bob.publicKeyBase64,
        privateKeyHex: bob.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    let result: ImportVaultResult | undefined
    await act(async () => {
      result = await ref.current?.importEncryptedVault(backup, SOURCE_PW)
    })
    assert.deepEqual(result, { imported: 1, skipped: 1, rejected: 1 })
  })

  it('persists every account from a multi-account batch in one re-encryption', async () => {
    const alice = await generateKeypair()
    const bob = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: alice.publicKeyBase64,
        privateKeyHex: alice.privateKeyHex,
        network: 'devnet',
      },
      {
        name: 'bob',
        partyId: 'bob::ns',
        publicKeyBase64: bob.publicKeyBase64,
        privateKeyHex: bob.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    let result: ImportVaultResult | undefined
    await act(async () => {
      result = await ref.current?.importEncryptedVault(backup, SOURCE_PW)
    })
    assert.deepEqual(result, { imported: 2, skipped: 0, rejected: 0 })

    // Both must survive a lock/unlock, proving the batch was re-encrypted to disk.
    await act(async () => {
      ref.current?.lock()
    })
    await act(async () => {
      await ref.current?.unlock(DEST_PW)
    })
    const names = ref.current?.accounts.map((a) => a.name).sort()
    assert.deepEqual(names, ['alice', 'bob'])
  })

  it('rejects import when the destination vault is locked', async () => {
    const kp = await generateKeypair()
    const backup = await makeBackup(SOURCE_PW, [
      {
        name: 'alice',
        partyId: 'alice::ns',
        publicKeyBase64: kp.publicKeyBase64,
        privateKeyHex: kp.privateKeyHex,
        network: 'devnet',
      },
    ])
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup(DEST_PW)
    })
    await act(async () => {
      ref.current?.lock()
    })
    await assert.rejects(
      () => ref.current?.importEncryptedVault(backup, SOURCE_PW) ?? Promise.resolve(),
      /vault locked/i,
    )
  })
})
