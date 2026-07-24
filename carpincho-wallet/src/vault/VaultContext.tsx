// Plaintext + unlock password live in module-scope closures, never in React
// state, so DevTools, error reporters, and Redux extensions never see them.

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { clearDirectConnectedOrigins } from '@/extension/directConnections'
import { broadcastWalletEvent } from '@/extension/eventBroadcast'
import { persistWalletSnapshot } from '@/extension/walletSnapshot'
import { accountToCip103Wallet } from '@/provider/accounts'
import { parseBackupContainer, wrapBackup } from '@/vault/backup'
import { assertSecureContext, decryptVault, encryptVault } from '@/vault/crypto'
import { derivePublicKeyBase64, signMessageBase64 } from '@/vault/keypair'
import { ensurePasswordStrengthReady, isPasswordAcceptable } from '@/vault/passwordStrength'
import {
  clearLockAt,
  clearSessionPassword,
  persistLockAt,
  persistSessionPassword,
  readLockAt,
  readSessionPassword,
  shouldWipeMemoryOnPageHide,
} from '@/vault/sessionUnlock'
import {
  type AutoLockOption,
  hasVault as hasVaultOnDisk,
  loadAutoLockOption,
  loadVault,
  rotateVault,
  wipeAllPersistedData,
  writeAutoLockOption,
  writeFreshVault,
} from '@/vault/storage'
import type {
  AccountPublic,
  AccountSecret,
  CarpinchoBackup,
  ImportVaultResult,
  TransactionRecord,
  VaultEnvelope,
  VaultPlaintext,
} from '@/vault/types'
import { wipeWalletConnectStorage } from '@/wc/storage'

const AUTO_LOCK_MS: Record<AutoLockOption, number | null> = {
  never: null,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
}
const MAX_TRANSACTION_HISTORY = 50

interface NewAccountArgs {
  name: string
  partyId: string
  network: string
  privateKeyHex: string
  publicKeyBase64: string
}

let unlockedPlaintext: VaultPlaintext | null = null
let cachedPassword: string | null = null

const wipeMemory = async (): Promise<void> => {
  if (cachedPassword !== null) {
    cachedPassword = ''
    cachedPassword = null
  }
  if (unlockedPlaintext !== null) {
    for (const a of unlockedPlaintext.accounts) {
      a.privateKeyHex = ''
    }
    unlockedPlaintext = null
  }
  await clearSessionPassword()
  await clearLockAt()
}

const toPublic = (a: AccountSecret, primaryId: string | null): AccountPublic => ({
  id: a.id,
  name: a.name,
  partyId: a.partyId,
  publicKeyBase64: a.publicKeyBase64,
  network: a.network,
  isPrimary: a.id === primaryId,
  createdAt: a.createdAt,
})

const generateId = (): string => {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const transactionHistory = (): TransactionRecord[] => unlockedPlaintext?.transactions ?? []

export interface VaultContextValue {
  isLocked: boolean
  isLoading: boolean
  hasVault: boolean
  setup: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  destroyVault: () => Promise<void>
  accounts: AccountPublic[]
  primary: AccountPublic | null
  transactions: TransactionRecord[]
  setPrimary: (id: string) => Promise<void>
  addAccount: (args: NewAccountArgs) => Promise<AccountPublic>
  removeAccount: (id: string) => Promise<void>
  exportEncryptedVault: (password: string) => Promise<CarpinchoBackup>
  importEncryptedVault: (file: unknown, password: string) => Promise<ImportVaultResult>
  signMessage: (accountId: string, messageBase64: string) => Promise<string>
  recordTransaction: (
    args: Omit<TransactionRecord, 'id' | 'createdAt'>,
  ) => Promise<TransactionRecord>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  verifyPassword: (password: string) => boolean
  autoLockOption: AutoLockOption
  setAutoLockOption: (option: AutoLockOption) => void
}

export const VaultContext = createContext<VaultContextValue | undefined>(undefined)

export const VaultProvider = ({ children }: PropsWithChildren): JSX.Element => {
  assertSecureContext()

  const [tick, setTick] = useState(0)
  const [isLocked, setIsLocked] = useState(unlockedPlaintext === null)
  const [vaultExists, setVaultExists] = useState(hasVaultOnDisk())
  const [isLoading, setIsLoading] = useState(() => unlockedPlaintext === null && hasVaultOnDisk())
  const [autoLockOption, setAutoLockOptionState] = useState<AutoLockOption>(() =>
    loadAutoLockOption(),
  )
  const idleTimer = useRef<number | undefined>(undefined)

  const bump = useCallback((): void => setTick((t) => t + 1), [])

  // dapp-api lifecycle events: `connected` on unlock, `statusChanged` on every
  // transition. isNetworkConnected stays true (Carpincho always targets the
  // configured wallet-service; reachability surfaces through later RPC calls).
  const broadcastConnectionState = useCallback((isConnected: boolean): void => {
    const connection = { isConnected, isNetworkConnected: true }
    if (isConnected) {
      void broadcastWalletEvent('connected', connection)
    }
    void broadcastWalletEvent('statusChanged', {
      provider: { id: 'carpincho-wallet', providerType: 'browser' },
      connection,
    })
  }, [])

  const lock = useCallback((): void => {
    void wipeMemory().catch(() => undefined)
    setIsLocked(true)
    bump()
    broadcastConnectionState(false)
  }, [bump, broadcastConnectionState])

  const persist = useCallback(async (): Promise<void> => {
    if (unlockedPlaintext === null || cachedPassword === null) {
      throw new Error('vault not unlocked')
    }
    const blob = await encryptVault(cachedPassword, JSON.stringify(unlockedPlaintext))
    rotateVault(blob)
  }, [])

  const setup = useCallback(
    async (password: string): Promise<void> => {
      if (hasVaultOnDisk()) {
        throw new Error('vault already exists')
      }
      if (password.length < 8) {
        throw new Error('password must be at least 8 characters')
      }
      await ensurePasswordStrengthReady()
      if (!isPasswordAcceptable(password)) {
        throw new Error('password is too weak')
      }
      const plaintext: VaultPlaintext = {
        v: 1,
        primaryAccountId: null,
        accounts: [],
        transactions: [],
      }
      const blob = await encryptVault(password, JSON.stringify(plaintext))
      writeFreshVault(blob)
      unlockedPlaintext = plaintext
      cachedPassword = password
      await persistSessionPassword(password)
      setVaultExists(true)
      setIsLocked(false)
      bump()
      broadcastConnectionState(true)
    },
    [bump, broadcastConnectionState],
  )

  const unlock = useCallback(
    async (password: string): Promise<void> => {
      const blob = loadVault()
      if (blob === null) {
        throw new Error('no vault to unlock')
      }
      let decrypted: string
      try {
        decrypted = await decryptVault(password, blob)
      } catch {
        throw new Error('invalid password')
      }
      const parsed = JSON.parse(decrypted) as VaultPlaintext
      if (parsed.v !== 1) {
        throw new Error(`unsupported vault payload version: ${String(parsed.v)}`)
      }
      parsed.transactions ??= []
      unlockedPlaintext = parsed
      cachedPassword = password
      await persistSessionPassword(password)
      setIsLocked(false)
      bump()
      broadcastConnectionState(true)
    },
    [bump, broadcastConnectionState],
  )

  const destroyVault = useCallback(async (): Promise<void> => {
    // Await every persistence surface that survives a reload: in-memory keys + session token,
    // the snapshot, WalletConnect's IndexedDB sessions, and the direct connected origins in
    // chrome.storage.session. The carpincho localStorage prefix wipe only covers localStorage.
    await wipeMemory().catch(() => undefined)
    await persistWalletSnapshot(null).catch(() => undefined)
    await wipeWalletConnectStorage().catch(() => undefined)
    await clearDirectConnectedOrigins().catch(() => undefined)
    wipeAllPersistedData()
    // Reload re-inits every provider from empty storage and is the primary reset mechanism,
    // but reset the React state too so the UI is consistent if a reload is ever a no-op.
    setVaultExists(false)
    setIsLocked(true)
    bump()
    broadcastConnectionState(false)
    window.location.reload()
  }, [bump, broadcastConnectionState])

  // dapp-api AccountsChangedEvent payload (Wallet[]); [] when locked.
  const accountsChangedPayload = useCallback((): unknown[] => {
    if (unlockedPlaintext === null) {
      return []
    }
    const primaryId = unlockedPlaintext.primaryAccountId
    return unlockedPlaintext.accounts.map((a) => accountToCip103Wallet(toPublic(a, primaryId)))
  }, [])

  const setPrimary = useCallback(
    async (id: string): Promise<void> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      if (!unlockedPlaintext.accounts.some((a) => a.id === id)) {
        throw new Error(`unknown account: ${id}`)
      }
      unlockedPlaintext.primaryAccountId = id
      await persist()
      bump()
      void broadcastWalletEvent('accountsChanged', accountsChangedPayload())
    },
    [persist, bump, accountsChangedPayload],
  )

  // In-memory insert shared by addAccount and the import merge: pushes the secret
  // and seeds primary if unset. Caller owns persist()/bump()/broadcast so a batch
  // import re-encrypts once instead of once per account. Assumes an unlocked vault.
  const insertAccount = useCallback((args: NewAccountArgs): AccountSecret => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    const secret: AccountSecret = {
      id: generateId(),
      name: args.name,
      partyId: args.partyId,
      privateKeyHex: args.privateKeyHex,
      publicKeyBase64: args.publicKeyBase64,
      network: args.network,
      createdAt: Date.now(),
    }
    unlockedPlaintext.accounts.push(secret)
    if (unlockedPlaintext.primaryAccountId === null) {
      unlockedPlaintext.primaryAccountId = secret.id
    }
    return secret
  }, [])

  // Caller supplies the keypair (already used to create the Canton party);
  // generating one here would desync the vault entry from the account.
  const addAccount = useCallback(
    async (args: NewAccountArgs): Promise<AccountPublic> => {
      const secret = insertAccount(args)
      await persist()
      bump()
      void broadcastWalletEvent('accountsChanged', accountsChangedPayload())
      return toPublic(secret, unlockedPlaintext?.primaryAccountId ?? null)
    },
    [insertAccount, persist, bump, accountsChangedPayload],
  )

  const recordTransaction = useCallback(
    async (args: Omit<TransactionRecord, 'id' | 'createdAt'>): Promise<TransactionRecord> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      const record: TransactionRecord = {
        id: generateId(),
        createdAt: Date.now(),
        ...args,
      }
      const next = [record, ...transactionHistory()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_TRANSACTION_HISTORY)
      unlockedPlaintext.transactions = next
      await persist()
      bump()
      return record
    },
    [persist, bump],
  )

  const removeAccount = useCallback(
    async (id: string): Promise<void> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      if (unlockedPlaintext.accounts.length <= 1) {
        throw new Error('cannot remove the last account')
      }
      unlockedPlaintext.accounts = unlockedPlaintext.accounts.filter((a) => a.id !== id)
      if (unlockedPlaintext.primaryAccountId === id) {
        unlockedPlaintext.primaryAccountId = unlockedPlaintext.accounts[0]?.id ?? null
      }
      await persist()
      bump()
      void broadcastWalletEvent('accountsChanged', accountsChangedPayload())
    },
    [persist, bump, accountsChangedPayload],
  )

  const signMessage = useCallback(
    async (accountId: string, messageBase64: string): Promise<string> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      const acct = unlockedPlaintext.accounts.find((a) => a.id === accountId)
      if (acct === undefined) {
        throw new Error(`unknown account: ${accountId}`)
      }
      return await signMessageBase64(acct.privateKeyHex, messageBase64)
    },
    [],
  )

  // Builds a portable backup of every account. Pure projection: omits id/createdAt,
  // never logged or persisted. Internal: consumed only by exportEncryptedVault.
  const buildEnvelope = useCallback((): VaultEnvelope => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    return {
      v: 1,
      accounts: unlockedPlaintext.accounts.map((a) => ({
        name: a.name,
        partyId: a.partyId,
        publicKeyBase64: a.publicKeyBase64,
        privateKeyHex: a.privateKeyHex,
        network: a.network,
      })),
    }
  }, [])

  // Restores accounts from an envelope. Per entry: the private key must derive the
  // stored public key and the partyId must be `hint::namespace`; duplicates are skipped.
  // Internal: consumed only by importEncryptedVault.
  const mergeEnvelope = useCallback(
    async (envelope: VaultEnvelope): Promise<ImportVaultResult> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      if (envelope?.v !== 1 || !Array.isArray(envelope.accounts)) {
        throw new Error('unsupported vault envelope')
      }
      let imported = 0
      let skipped = 0
      let rejected = 0
      for (const raw of envelope.accounts as unknown[]) {
        const entry = raw as Record<string, unknown>
        // Import is the only ungated, externally-supplied path, so reject any entry
        // whose required fields are not strings before they reach the encrypted store.
        if (
          raw === null ||
          typeof raw !== 'object' ||
          typeof entry.name !== 'string' ||
          typeof entry.partyId !== 'string' ||
          typeof entry.publicKeyBase64 !== 'string' ||
          typeof entry.privateKeyHex !== 'string' ||
          typeof entry.network !== 'string'
        ) {
          rejected += 1
          continue
        }
        const { name, partyId, publicKeyBase64, privateKeyHex, network } = entry
        let derived: string
        try {
          derived = await derivePublicKeyBase64(privateKeyHex)
        } catch {
          rejected += 1
          continue
        }
        if (derived !== publicKeyBase64 || !/^.+::.+$/.test(partyId)) {
          rejected += 1
          continue
        }
        if (unlockedPlaintext.accounts.some((a) => a.partyId === partyId)) {
          skipped += 1
          continue
        }
        insertAccount({ name, partyId, network, privateKeyHex, publicKeyBase64 })
        imported += 1
      }
      // Re-encrypt once for the whole batch rather than per account.
      if (imported > 0) {
        await persist()
        bump()
        void broadcastWalletEvent('accountsChanged', accountsChangedPayload())
      }
      return { imported, skipped, rejected }
    },
    [insertAccount, persist, bump, accountsChangedPayload],
  )

  const exportEncryptedVault = useCallback(
    async (password: string): Promise<CarpinchoBackup> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      // Enforces file-password == vault-password and re-authenticates the user.
      if (cachedPassword !== password) {
        throw new Error('invalid password')
      }
      const envelope = buildEnvelope()
      const vault = await encryptVault(password, JSON.stringify(envelope))
      return wrapBackup(vault)
    },
    [buildEnvelope],
  )

  const importEncryptedVault = useCallback(
    async (file: unknown, password: string): Promise<ImportVaultResult> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      const encrypted = parseBackupContainer(file)
      let plaintext: string
      try {
        plaintext = await decryptVault(password, encrypted)
      } catch {
        throw new Error('Wrong password for this file.')
      }
      const envelope = JSON.parse(plaintext) as VaultEnvelope
      return await mergeEnvelope(envelope)
    },
    [mergeEnvelope],
  )

  const verifyPassword = useCallback(
    (password: string): boolean => cachedPassword !== null && cachedPassword === password,
    [],
  )

  const setAutoLockOption = useCallback((option: AutoLockOption): void => {
    writeAutoLockOption(option)
    setAutoLockOptionState(option)
  }, [])

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<void> => {
      if (unlockedPlaintext === null) {
        throw new Error('vault locked')
      }
      if (cachedPassword !== oldPassword) {
        throw new Error('invalid current password')
      }
      if (newPassword.length < 8) {
        throw new Error('new password must be at least 8 characters')
      }
      await ensurePasswordStrengthReady()
      if (!isPasswordAcceptable(newPassword)) {
        throw new Error('new password is too weak')
      }
      const blob = await encryptVault(newPassword, JSON.stringify(unlockedPlaintext))
      rotateVault(blob)
      cachedPassword = newPassword
      await persistSessionPassword(newPassword)
      bump()
    },
    [bump],
  )

  useEffect(() => {
    if (unlockedPlaintext !== null || !hasVaultOnDisk()) {
      setIsLoading(false)
      return
    }
    void (async () => {
      try {
        const stored = await readSessionPassword()
        if (stored === null || stored === '') {
          return
        }
        const lockAt = await readLockAt()
        if (lockAt !== null && Date.now() >= lockAt) {
          await clearSessionPassword()
          await clearLockAt()
          return
        }
        await unlock(stored).catch(() => {
          void clearSessionPassword()
        })
      } finally {
        setIsLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock])

  // Idle auto-lock driven by window activity (not tab visibility) so dApp WC requests still flow.
  useEffect(() => {
    if (isLocked) {
      return
    }
    const idleMs = AUTO_LOCK_MS[autoLockOption]
    if (idleMs === null) {
      void clearLockAt()
      return
    }
    // setTimeout enforces the deadline; lockAt only matters for the next reload,
    // so throttle writes from rapid activity events to avoid hammering storage.
    const PERSIST_THROTTLE_MS = 5000
    let lastPersistedAt = 0
    const reset = (): void => {
      if (idleTimer.current !== undefined) {
        window.clearTimeout(idleTimer.current)
      }
      idleTimer.current = window.setTimeout(lock, idleMs)
      const next = Date.now() + idleMs
      if (next - lastPersistedAt >= PERSIST_THROTTLE_MS) {
        lastPersistedAt = next
        void persistLockAt(next)
      }
    }
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ]
    for (const e of events) {
      window.addEventListener(e, reset, { passive: true })
    }
    reset()
    return () => {
      for (const e of events) {
        window.removeEventListener(e, reset)
      }
      if (idleTimer.current !== undefined) {
        window.clearTimeout(idleTimer.current)
      }
    }
  }, [isLocked, lock, autoLockOption])

  useEffect(() => {
    const onUnload = (): void => {
      // 'never' opts out of auto-lock: keep the session token so refresh restores unlock.
      if (shouldWipeMemoryOnPageHide() && autoLockOption !== 'never') {
        void wipeMemory().catch(() => undefined)
      }
    }
    window.addEventListener('pagehide', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
    }
  }, [autoLockOption])

  // `tick` is bumped by every in-place mutation of `unlockedPlaintext`, forcing
  // this memo to recompute accounts/primary/transactions from the latest state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  const value = useMemo<VaultContextValue>(() => {
    const primaryId = unlockedPlaintext?.primaryAccountId ?? null
    const accounts =
      unlockedPlaintext === null
        ? []
        : unlockedPlaintext.accounts.map((a) => toPublic(a, primaryId))
    const primary = accounts.find((a) => a.isPrimary) ?? null
    const transactions =
      unlockedPlaintext === null
        ? []
        : [...transactionHistory()].sort((a, b) => b.createdAt - a.createdAt)
    return {
      isLocked,
      isLoading,
      hasVault: vaultExists,
      setup,
      unlock,
      lock,
      destroyVault,
      accounts,
      primary,
      transactions,
      setPrimary,
      addAccount,
      removeAccount,
      exportEncryptedVault,
      importEncryptedVault,
      signMessage,
      recordTransaction,
      changePassword,
      verifyPassword,
      autoLockOption,
      setAutoLockOption,
    }
  }, [
    tick,
    isLocked,
    isLoading,
    vaultExists,
    setup,
    unlock,
    lock,
    destroyVault,
    setPrimary,
    addAccount,
    removeAccount,
    exportEncryptedVault,
    importEncryptedVault,
    signMessage,
    recordTransaction,
    changePassword,
    verifyPassword,
    autoLockOption,
    setAutoLockOption,
  ])

  useEffect(() => {
    void persistWalletSnapshot(
      isLocked
        ? null
        : {
            accounts: value.accounts,
            primary: value.primary,
          },
    ).catch(() => undefined)
  }, [isLocked, value.accounts, value.primary])

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}
