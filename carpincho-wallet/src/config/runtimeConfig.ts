export interface RuntimeConfig {
  walletServiceRpcUrl: string
}

const STORAGE_KEY = 'carpincho.runtime-config.v2'

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  walletServiceRpcUrl: 'http://localhost:3010/rpc',
}

type ChromeLocalStorage = {
  get: (key: string) => Promise<Record<string, unknown>> | Record<string, unknown>
  set: (items: Record<string, unknown>) => Promise<void> | void
}

const chromeLocalStorage = (): ChromeLocalStorage | undefined =>
  (
    globalThis as {
      chrome?: {
        storage?: {
          local?: ChromeLocalStorage
        }
      }
    }
  ).chrome?.storage?.local

const browserLocalStorage = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

const dispatchRuntimeConfigChange = (config: RuntimeConfig): void => {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent('carpincho-runtime-config-changed', { detail: config }))
}

// Mirrors popup-local config into extension storage so the MV3 worker can reach wallet-service.
const persistChromeRuntimeConfig = (config: RuntimeConfig): void => {
  void Promise.resolve(chromeLocalStorage()?.set({ [STORAGE_KEY]: config })).catch(() => undefined)
}

export const defaultRuntimeConfig = (): RuntimeConfig => ({
  ...DEFAULT_RUNTIME_CONFIG,
})

const sanitizeRuntimeConfig = (raw: Partial<RuntimeConfig>): RuntimeConfig => {
  const defaults = defaultRuntimeConfig()
  return {
    walletServiceRpcUrl: raw.walletServiceRpcUrl?.trim() ?? defaults.walletServiceRpcUrl,
  }
}

export const loadRuntimeConfig = (): RuntimeConfig => {
  try {
    const storage = browserLocalStorage()
    if (storage === undefined) {
      return defaultRuntimeConfig()
    }
    const stored = storage.getItem(STORAGE_KEY)
    if (stored === null) {
      return defaultRuntimeConfig()
    }
    const sanitized = sanitizeRuntimeConfig(JSON.parse(stored) as Partial<RuntimeConfig>)
    persistChromeRuntimeConfig(sanitized)
    return sanitized
  } catch {
    return defaultRuntimeConfig()
  }
}

// Reads the endpoint from extension storage when running in an MV3 worker without localStorage.
export const loadRuntimeConfigAsync = async (): Promise<RuntimeConfig> => {
  try {
    const storage = chromeLocalStorage()
    if (storage !== undefined) {
      const stored = await storage.get(STORAGE_KEY)
      const config = stored[STORAGE_KEY]
      if (typeof config === 'object' && config !== null) {
        return sanitizeRuntimeConfig(config as Partial<RuntimeConfig>)
      }
    }
  } catch {
    return loadRuntimeConfig()
  }
  return loadRuntimeConfig()
}

export const saveRuntimeConfig = (config: RuntimeConfig): RuntimeConfig => {
  const sanitized = sanitizeRuntimeConfig(config)
  const storage = browserLocalStorage()
  if (storage !== undefined) {
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  }
  persistChromeRuntimeConfig(sanitized)
  dispatchRuntimeConfigChange(sanitized)
  return sanitized
}

export const subscribeRuntimeConfig = (listener: (config: RuntimeConfig) => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      listener(loadRuntimeConfig())
    }
  }
  const onCustom = (event: Event): void => {
    listener((event as CustomEvent<RuntimeConfig>).detail)
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('carpincho-runtime-config-changed', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('carpincho-runtime-config-changed', onCustom)
  }
}
