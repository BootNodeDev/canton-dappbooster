// On-disk shape. Binary fields are base64. Bump `v` and add a migration in storage.ts on layout changes.
export interface EncryptedVault {
  v: 1
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
    data: string
  }
}

export interface VaultPlaintext {
  v: 1
  primaryAccountId: string | null
  accounts: AccountSecret[]
  transactions?: TransactionRecord[]
}

export interface AccountSecret {
  id: string
  name: string
  partyId: string
  privateKeyHex: string
  publicKeyBase64: string
  network: string
  createdAt: number
}

// Public projection — never includes the private key.
export interface AccountPublic {
  id: string
  name: string
  partyId: string
  publicKeyBase64: string
  network: string
  isPrimary: boolean
  createdAt: number
}

export interface TransactionRecord {
  id: string
  accountId: string
  accountName: string
  partyId: string
  network: string
  method: string
  status: 'executed'
  createdAt: number
  preparedTransaction?: string
  preparedTransactionHash: string
  commands?: unknown[]
  commandId?: string
  submissionId?: string
  updateId?: string
  completionOffset?: number
  commandCount?: number
  summary?: string
}

export interface VaultEnvelopeAccount {
  name: string
  partyId: string
  publicKeyBase64: string
  privateKeyHex: string
  network: string
}

export interface VaultEnvelope {
  v: 1
  accounts: VaultEnvelopeAccount[]
}

export interface ImportVaultResult {
  imported: number
  skipped: number
  rejected: number
}

// Self-describing encrypted backup file. `kind` + `version` are the type-confusion guard:
// an on-disk EncryptedVault has no `kind`, so it can never be imported as a backup.
// `vault` is encryptVault(JSON.stringify(VaultEnvelope)).
export interface CarpinchoBackup {
  kind: 'carpincho-backup'
  version: 1
  vault: EncryptedVault
}
