// Domain-marked container around an EncryptedVault, plus the guard that protects the
// import path from being fed a raw vault blob (or any unrelated JSON).
import { isRecord } from '@/extension/messages'
import type { CarpinchoBackup, EncryptedVault } from '@/vault/types'

// Typed by the interface so the on-disk format markers have a single source of truth.
const BACKUP_KIND: CarpinchoBackup['kind'] = 'carpincho-backup'
const BACKUP_VERSION: CarpinchoBackup['version'] = 1

const isEncryptedVault = (x: unknown): x is EncryptedVault =>
  isRecord(x) && x.v === 1 && isRecord(x.kdf) && isRecord(x.cipher)

const isCarpinchoBackup = (x: unknown): x is CarpinchoBackup =>
  isRecord(x) && x.kind === BACKUP_KIND && x.version === BACKUP_VERSION && isEncryptedVault(x.vault)

export const wrapBackup = (vault: EncryptedVault): CarpinchoBackup => ({
  kind: BACKUP_KIND,
  version: BACKUP_VERSION,
  vault,
})

// Returns the embedded EncryptedVault, or throws a human-readable error if the value
// is not a recognizable Carpincho backup container.
export const parseBackupContainer = (file: unknown): EncryptedVault => {
  if (!isCarpinchoBackup(file)) {
    throw new Error("This file isn't a Carpincho backup.")
  }
  return file.vault
}
