import { useSelector } from '@xstate/react'
import { useCallback } from 'react'
import type { CantonConnectProvider } from '#src/CantonConnectProvider'
import { assertUsable, useWalletCall } from '#src/hooks/useWalletCall'
import type { DappSdkMethods, PartyType } from '#src/types'

const namespaceOf = (id: string): string | undefined => /::(.+)$/.exec(id)?.[1]

const readParticipantNamespace = async (sdk: DappSdkMethods): Promise<string> => {
  const answer = await sdk.ledgerApi({
    requestMethod: 'get',
    resource: '/v2/parties/participant-id',
  })
  const namespace =
    typeof answer.participantId === 'string' ? namespaceOf(answer.participantId) : undefined

  if (namespace === undefined) {
    throw new Error(`participant id not found in ${JSON.stringify(answer)}`)
  }

  return namespace
}

/**
 * Return shape of {@link usePartyType}. `readPartyType` throws when nothing is connected or no
 * party is reported, which `isReady` is there to check first.
 *
 * @category Hooks
 */
export interface UsePartyTypeResult {
  readPartyType: () => Promise<PartyType>
  isReady: boolean
}

/**
 * Tells a local party from an external one when asked. Each `readPartyType` call is one
 * `ledgerApi` read of the participant id, its namespace compared with the party's; nothing is
 * cached, so hold the answer where several components need it. Reach for it before an action a
 * local party cannot take, such as `signMessage`, which the reference gateway refuses.
 *
 * @throws with no {@link CantonConnectProvider} above it, and from `readPartyType` where nothing
 * is connected or no party is reported, which `isReady` is there to check first.
 *
 * @example
 * const { readPartyType } = usePartyType()
 * if ((await readPartyType()) === 'local') {
 *   toast.error('This wallet cannot sign messages for a local party')
 * }
 *
 * @category Hooks
 */
export const usePartyType = (): UsePartyTypeResult => {
  // Guards without `call`: a stateless query needs no pending/error renders around it.
  const { connection, sdk, status, isLocked } = useWalletCall()
  const account = useSelector(connection, (snapshot) => snapshot.context.account)

  const readPartyType = useCallback(async (): Promise<PartyType> => {
    assertUsable(status, isLocked)

    if (account === undefined) {
      throw new Error('wallet reports no primary account - select or add one in the wallet')
    }

    const participantNamespace = await readParticipantNamespace(sdk)

    // Canton's rule, not a wallet's: a local party shares the participant's namespace.
    return account.namespace === participantNamespace ? 'local' : 'external'
  }, [account, isLocked, sdk, status])

  return { readPartyType, isReady: status === 'connected' && !isLocked && account !== undefined }
}
