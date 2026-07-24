export interface RuntimeConfig {
  cantonNetwork: string
  walletCompanionUrl: string
}

const STORAGE_KEY = 'dapp.frontend.runtime-config.v1'

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  cantonNetwork: 'canton:local',
  walletCompanionUrl: 'http://localhost:3011',
}

export const defaultRuntimeConfig = (): RuntimeConfig => ({
  ...DEFAULT_RUNTIME_CONFIG,
})

const normalizeNetwork = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return DEFAULT_RUNTIME_CONFIG.cantonNetwork
  }
  return trimmed.startsWith('canton:') ? trimmed : `canton:${trimmed}`
}

const sanitizeRuntimeConfig = (raw: Partial<RuntimeConfig>): RuntimeConfig => ({
  cantonNetwork: normalizeNetwork(raw.cantonNetwork ?? DEFAULT_RUNTIME_CONFIG.cantonNetwork),
  walletCompanionUrl:
    raw.walletCompanionUrl?.trim() === ''
      ? DEFAULT_RUNTIME_CONFIG.walletCompanionUrl
      : (raw.walletCompanionUrl?.trim() ?? DEFAULT_RUNTIME_CONFIG.walletCompanionUrl),
})

export const loadRuntimeConfig = (): RuntimeConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      return defaultRuntimeConfig()
    }
    return sanitizeRuntimeConfig(JSON.parse(stored) as Partial<RuntimeConfig>)
  } catch {
    return defaultRuntimeConfig()
  }
}
