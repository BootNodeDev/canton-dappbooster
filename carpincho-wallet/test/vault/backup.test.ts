import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { parseBackupContainer, wrapBackup } from '@/vault/backup'
import type { EncryptedVault } from '@/vault/types'

const sampleVault: EncryptedVault = {
  v: 1,
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'c2FsdA==' },
  cipher: { name: 'AES-GCM', iv: 'aXY=', data: 'ZGF0YQ==' },
}

describe('vault backup container', () => {
  it('wraps an EncryptedVault with the domain marker', () => {
    const backup = wrapBackup(sampleVault)
    assert.equal(backup.kind, 'carpincho-backup')
    assert.equal(backup.version, 1)
    assert.deepEqual(backup.vault, sampleVault)
  })

  it('returns the embedded vault for a valid container', () => {
    assert.deepEqual(parseBackupContainer(wrapBackup(sampleVault)), sampleVault)
  })

  it('rejects a raw EncryptedVault (no kind marker)', () => {
    assert.throws(() => parseBackupContainer(sampleVault), /isn't a Carpincho backup/i)
  })

  it('rejects a wrong kind', () => {
    assert.throws(
      () => parseBackupContainer({ kind: 'other', version: 1, vault: sampleVault }),
      /isn't a Carpincho backup/i,
    )
  })

  it('rejects an unsupported container version', () => {
    assert.throws(
      () => parseBackupContainer({ kind: 'carpincho-backup', version: 2, vault: sampleVault }),
      /isn't a Carpincho backup/i,
    )
  })

  it('rejects a container whose payload is not an EncryptedVault', () => {
    assert.throws(
      () => parseBackupContainer({ kind: 'carpincho-backup', version: 1, vault: { nope: true } }),
      /isn't a Carpincho backup/i,
    )
  })

  it('rejects null and non-objects', () => {
    assert.throws(() => parseBackupContainer(null), /isn't a Carpincho backup/i)
    assert.throws(() => parseBackupContainer('x'), /isn't a Carpincho backup/i)
  })
})
