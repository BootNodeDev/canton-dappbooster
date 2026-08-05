// Backend construction point: no deployment config means the in-memory MockBackend, a real
// vesting-lite-parties.json means a LiteBackend over the wallet-service ledgerApi proxy.

import { MockBackend } from '@/mock/MockBackend'
import { seedView } from '@/mock/seed'
import type { Wallet } from '@/wallet/Wallet'
import { LiteBackend } from './LiteBackend'
import type { Deployment, VestingBackend } from './VestingBackend'

export type BackendConfig = { rpcUrl: string; deployment: Deployment }

const DEFAULT_RPC_URL = 'http://localhost:3010/rpc'

const CONFIG_FILE = '/vesting-lite-parties.json'

const EMPTY: BackendConfig = { rpcUrl: '', deployment: { pkg: '', operator: '' } }

type ConfigFile = { pkg?: string; operator?: string; rpcUrl?: string }

// An absent or malformed config file is not an error: it is what mock-first mode looks like.
export const loadBackendConfig = async (): Promise<BackendConfig> => {
  try {
    const response = await fetch(CONFIG_FILE)
    if (!response.ok) {
      return EMPTY
    }
    const data = (await response.json()) as ConfigFile
    return {
      rpcUrl: data.rpcUrl ?? DEFAULT_RPC_URL,
      deployment: { pkg: data.pkg ?? '', operator: data.operator ?? '' },
    }
  } catch {
    return EMPTY
  }
}

// A real deployment is present only when the bootstrap wrote both a package id and
// an rpc url. Absent either, the app runs mock-first with zero services.
export const isDeployed = (config: BackendConfig): boolean =>
  config.deployment.pkg !== '' && config.rpcUrl !== ''

export const createBackend = (config: BackendConfig, wallet: Wallet): VestingBackend =>
  isDeployed(config)
    ? new LiteBackend(config.rpcUrl, config.deployment, wallet)
    : new MockBackend(seedView())
