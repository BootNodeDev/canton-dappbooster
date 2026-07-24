import { useEffect, useMemo, useState } from 'react'
import {
  getDirectConnectedOrigins,
  subscribeToDirectConnectedOrigins,
} from '@/extension/runtimeClient'
import type { ConnectedDappSession } from '@/wc/client'

interface ChromeTab {
  url?: string
  title?: string
  favIconUrl?: string
}

interface ChromeApi {
  tabs?: {
    query: (
      queryInfo: { active: true; currentWindow: true },
      callback: (tabs: ChromeTab[]) => void,
    ) => void
  }
}

export type DappConnectionStatus =
  | { kind: 'none' }
  | {
      kind: 'detected' | 'connected'
      label: string
      host: string
      subtitle: string
      origin: string
      icon?: string
    }

interface DappConnectionSources {
  extensionMode: boolean
  sessions: ConnectedDappSession[]
  directConnectedOrigins?: string[]
  activeTab?: ChromeTab
}

// Reads the Chrome runtime only when the popup is running inside the extension.
const chromeApi = (): ChromeApi | undefined => (globalThis as { chrome?: ChromeApi }).chrome

// Returns the best compact label for a dApp page URL.
const labelFromUrl = (url: string): string => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// The dApp origin used as the disconnect key for direct injected-provider connections.
const originFromUrl = (url: string): string => {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

// Active-tab metadata only exists for normal web pages the popup can inspect.
const normalizedWebTab = (tab: ChromeTab | undefined): ChromeTab | undefined => {
  if (tab?.url === undefined) {
    return undefined
  }
  try {
    const url = new URL(tab.url)
    return url.protocol === 'http:' || url.protocol === 'https:' ? tab : undefined
  } catch {
    return undefined
  }
}

// Compares dApp session URLs by origin so route changes do not break connected-state display.
const sameOrigin = (left: string, right: string): boolean => {
  try {
    return new URL(left).origin === new URL(right).origin
  } catch {
    return false
  }
}

// Reads the active tab when the extension popup is opened.
const queryActiveTab = async (): Promise<ChromeTab | undefined> =>
  await new Promise((resolve) => {
    const tabs = chromeApi()?.tabs
    if (tabs === undefined) {
      resolve(undefined)
      return
    }
    tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(normalizedWebTab(tab))
    })
  })

// Derives the footer dApp row from the active tab and known dApp connection state.
export const dappConnectionFromSources = ({
  extensionMode,
  sessions,
  directConnectedOrigins = [],
  activeTab,
}: DappConnectionSources): DappConnectionStatus => {
  const tab = normalizedWebTab(activeTab)
  if (extensionMode) {
    if (tab?.url === undefined) {
      return { kind: 'none' }
    }
    const connected =
      directConnectedOrigins.some((origin) => sameOrigin(origin, tab.url as string)) ||
      sessions.some((session) => sameOrigin(session.url, tab.url as string))
    const host = labelFromUrl(tab.url)
    return {
      kind: connected ? 'connected' : 'detected',
      label: host,
      host,
      subtitle: connected ? 'Connected' : 'Not connected',
      origin: originFromUrl(tab.url),
      ...(tab.favIconUrl === undefined ? {} : { icon: tab.favIconUrl }),
    }
  }

  const connectedSession = sessions[0]
  if (connectedSession !== undefined) {
    const host = labelFromUrl(connectedSession.url)
    return {
      kind: 'connected',
      label: connectedSession.name.trim() === '' ? host : connectedSession.name,
      host,
      subtitle: 'Connected',
      origin: originFromUrl(connectedSession.url),
      ...(connectedSession.icon === undefined ? {} : { icon: connectedSession.icon }),
    }
  }

  return { kind: 'none' }
}

// Memoizes the current dApp footer state from wallet runtime inputs.
export const useExtensionDappConnection = (
  sources: DappConnectionSources,
): DappConnectionStatus => {
  const { extensionMode, sessions } = sources
  const [activeTab, setActiveTab] = useState<ChromeTab | undefined>(sources.activeTab)
  const [runtimeConnectedOrigins, setRuntimeConnectedOrigins] = useState<string[]>([])

  useEffect(() => {
    if (!extensionMode) {
      return
    }
    void queryActiveTab().then(setActiveTab)
  }, [extensionMode])

  useEffect(() => {
    if (!extensionMode || sources.directConnectedOrigins !== undefined) {
      return
    }
    let mounted = true
    let changeSeq = 0
    const seqAtRequest = changeSeq
    const unsubscribe = subscribeToDirectConnectedOrigins((origins) => {
      changeSeq += 1
      if (mounted) {
        setRuntimeConnectedOrigins(origins)
      }
    })
    void getDirectConnectedOrigins()
      .then((origins) => {
        if (mounted && changeSeq === seqAtRequest) {
          setRuntimeConnectedOrigins(origins)
        }
      })
      .catch(() => undefined)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [extensionMode, sources.directConnectedOrigins])

  const directConnectedOrigins = sources.directConnectedOrigins ?? runtimeConnectedOrigins

  return useMemo(
    () => dappConnectionFromSources({ extensionMode, sessions, directConnectedOrigins, activeTab }),
    [activeTab, directConnectedOrigins, extensionMode, sessions],
  )
}
