import { useSelector } from '@xstate/react'
import { useCallback } from 'react'
import type { CantonConnectProvider } from '#src/CantonConnectProvider'
import { useWalletCall } from '#src/hooks/useWalletCall'
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
    throw new Error('participant id not found in the ledger answer', { cause: answer })
  }

  return namespace
}

/**
 * Return shape of {@link usePartyType}; check `isReady` before calling `readPartyType`.
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
 * is connected, the wallet is locked or no party is reported, which `isReady` is there to check
 * first. It throws too when the ledger's answer carries no usable participant id, and on a refused
 * read, always as an `Error`: see {@link toError}.
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
  const { connection, read, status, isLocked } = useWalletCall()
  const account = useSelector(connection, (snapshot) => snapshot.context.account)

  const readPartyType = useCallback(
    (): Promise<PartyType> =>
      read(async (sdk) => {
        if (account === undefined) {
          throw new Error('wallet reports no primary account - select or add one in the wallet')
        }

        const participantNamespace = await readParticipantNamespace(sdk)

        // Canton's rule, not a wallet's: a local party shares the participant's namespace.
        return account.namespace === participantNamespace ? 'local' : 'external'
      }),
    [account, read],
  )

  return { readPartyType, isReady: status === 'connected' && !isLocked && account !== undefined }
}
