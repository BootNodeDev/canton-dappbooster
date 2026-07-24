import { Core } from '@walletconnect/core'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import SignClient from '@walletconnect/sign-client'
import type { SignClientTypes } from '@walletconnect/types'
import { getSdkError } from '@walletconnect/utils'
import { getWalletServiceNetworkId } from '@/api/walletService'
import type { ProviderResponder } from '@/provider/types'

export const CANTON_NAMESPACE = 'canton'

export const CANTON_METHOD_CONNECT = 'connect'
export const CANTON_METHOD_DISCONNECT = 'disconnect'
export const CANTON_METHOD_IS_CONNECTED = 'isConnected'
export const CANTON_METHOD_PREPARE_EXECUTE = 'prepareExecute'
export const CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT = 'prepareExecuteAndWait'
export const CANTON_METHOD_LIST_ACCOUNTS = 'listAccounts'
export const CANTON_METHOD_GET_PRIMARY_ACCOUNT = 'getPrimaryAccount'
export const CANTON_METHOD_GET_ACTIVE_NETWORK = 'getActiveNetwork'
export const CANTON_METHOD_STATUS = 'status'
export const CANTON_METHOD_LEDGER_API = 'ledgerApi'
export const CANTON_METHOD_SIGN_MESSAGE = 'signMessage'

const LEGACY_CANTON_METHODS = [
  'canton_prepareSignExecute',
  'canton_listAccounts',
  'canton_getPrimaryAccount',
  'canton_getActiveNetwork',
  'canton_status',
  'canton_ledgerApi',
  'canton_signMessage',
]

// Must be a superset of what @canton-network/dapp-sdk's WalletConnectAdapter requires.
export const CIP103_METHODS = [
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  CANTON_METHOD_IS_CONNECTED,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_STATUS,
  CANTON_METHOD_LEDGER_API,
  CANTON_METHOD_SIGN_MESSAGE,
  ...LEGACY_CANTON_METHODS,
]

export const CIP103_EVENTS = ['accountsChanged', 'statusChanged', 'txChanged']

const getWalletConnectProjectId = (): string =>
  ((import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ?? '').trim()

// Discovers the WalletConnect CAIP-2 chain from wallet-service status.
export const getCantonChain = async (): Promise<string> => await getWalletServiceNetworkId()

let signClientPromise: Promise<InstanceType<typeof SignClient>> | undefined
let signClientProjectId: string | undefined

export const getSignClient = async (): Promise<InstanceType<typeof SignClient>> => {
  const projectId = getWalletConnectProjectId()
  if (signClientPromise !== undefined && signClientProjectId === projectId) {
    return await signClientPromise
  }
  if (projectId === '') {
    throw new Error('WalletConnect project id is not set')
  }
  signClientProjectId = projectId
  signClientPromise = (async () => {
    const core = new Core({ projectId, customStoragePrefix: 'carpincho-wallet' })
    return await SignClient.init({
      core,
      metadata: {
        name: 'Carpincho Wallet',
        description: 'Argentinian Canton wallet',
        url: window.location.origin,
        icons: [`${window.location.origin}/carpincho-icon.svg`],
      },
    })
  })().catch((err: unknown) => {
    if (signClientProjectId === projectId) {
      signClientProjectId = undefined
      signClientPromise = undefined
    }
    throw err
  })
  return await signClientPromise
}

export type ProposalEvent = SignClientTypes.EventArguments['session_proposal']
export type RequestEvent = SignClientTypes.EventArguments['session_request']

const isStaleWalletConnectRequestError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Record was recently deleted') || message.includes('Missing or invalid')
}

const respond = async (
  args: Parameters<InstanceType<typeof SignClient>['respond']>[0],
): Promise<void> => {
  const client = await getSignClient()
  try {
    await client.respond(args)
  } catch (error) {
    if (isStaleWalletConnectRequestError(error)) {
      console.warn('[carpincho:wc] skipped late response', {
        topic: args.topic,
        id: args.response.id,
        error,
      })
      return
    }
    throw error
  }
}

export const approveProposal = async (args: {
  proposal: ProposalEvent
  partyId: string
}): Promise<void> => {
  const client = await getSignClient()
  const chain = await getCantonChain()
  await client.approve({
    id: args.proposal.id,
    namespaces: {
      [CANTON_NAMESPACE]: {
        accounts: [`${chain}:${encodeURIComponent(args.partyId)}`],
        chains: [chain],
        methods: CIP103_METHODS,
        events: CIP103_EVENTS,
      },
    },
  })
}

export const rejectProposal = async (proposalId: number): Promise<void> => {
  const client = await getSignClient()
  await client.reject({ id: proposalId, reason: getSdkError('USER_REJECTED') })
}

export const respondWithResult = async <T>(
  topic: string,
  requestId: number,
  result: T,
): Promise<void> => {
  await respond({ topic, response: formatJsonRpcResult(requestId, result) })
}

export const respondWithError = async (
  topic: string,
  requestId: number,
  code: number,
  message: string,
): Promise<void> => {
  await respond({ topic, response: formatJsonRpcError(requestId, { code, message }) })
}

// Adapts a WalletConnect request event to the provider responder used by request handling.
export const walletConnectResponder = (req: RequestEvent): ProviderResponder => ({
  result: async (value) => {
    await respondWithResult(req.topic, req.id, value)
  },
  error: async (code, message) => {
    await respondWithError(req.topic, req.id, code, message)
  },
})

export const pairWithUri = async (uri: string): Promise<void> => {
  const client = await getSignClient()
  await client.core.pairing.pair({ uri })
}

export interface ConnectedDappSession {
  topic: string
  name: string
  url: string
  description: string
  // Party IDs the session was approved with (decoded from the CAIP account strings).
  accounts: string[]
  icon?: string
}

// CAIP account is `<chain>:<encodeURIComponent(partyId)>`; party id is the last segment.
const partyIdsFromNamespaces = (
  namespaces: ReturnType<
    InstanceType<typeof SignClient>['session']['getAll']
  >[number]['namespaces'],
): string[] =>
  Object.values(namespaces).flatMap((ns) =>
    ns.accounts.map((account) => {
      const encoded = account.split(':').pop() ?? ''
      try {
        return decodeURIComponent(encoded)
      } catch {
        return encoded
      }
    }),
  )

const toConnectedDappSession = (
  session: ReturnType<InstanceType<typeof SignClient>['session']['getAll']>[number],
): ConnectedDappSession => ({
  topic: session.topic,
  name: session.peer.metadata.name,
  url: session.peer.metadata.url,
  description: session.peer.metadata.description,
  accounts: partyIdsFromNamespaces(session.namespaces),
  icon: session.peer.metadata.icons?.[0],
})

export const getConnectedDappSessions = async (): Promise<ConnectedDappSession[]> => {
  const client = await getSignClient()
  return client.session.getAll().map(toConnectedDappSession)
}

export const disconnectSession = async (topic: string): Promise<void> => {
  const client = await getSignClient()
  await client.disconnect({ topic, reason: { code: 6000, message: 'user disconnected' } })
}

export const subscribeToSessionChanges = async (
  cb: (sessions: ConnectedDappSession[]) => void,
): Promise<() => void> => {
  const client = await getSignClient()
  const emitter = client as unknown as {
    on: (event: string, cb: () => void) => void
    off: (event: string, cb: () => void) => void
  }
  const refresh = (): void => {
    void getConnectedDappSessions()
      .then(cb)
      .catch(() => undefined)
  }
  const events = ['session_delete', 'session_expire', 'session_update', 'session_extend'] as const
  for (const event of events) {
    emitter.on(event, refresh)
  }
  refresh()
  return () => {
    for (const event of events) {
      emitter.off(event, refresh)
    }
  }
}

export const subscribeToProposals = async (cb: (e: ProposalEvent) => void): Promise<() => void> => {
  const client = await getSignClient()
  client.on('session_proposal', cb)
  return () => client.off('session_proposal', cb)
}

export const subscribeToRequests = async (cb: (e: RequestEvent) => void): Promise<() => void> => {
  const client = await getSignClient()
  client.on('session_request', cb)
  return () => client.off('session_request', cb)
}
