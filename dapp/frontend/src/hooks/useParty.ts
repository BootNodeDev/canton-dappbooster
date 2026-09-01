import { useParty as useWalletParty, useWalletStatus } from '@bootnodedev/canton-connect'
import { partyHint } from '@bootnodedev/canton-dappbooster'
import { useMemo } from 'react'

export type PartyRef = { name: string; networkId: string; partyId: string }

export interface UsePartyResult {
  isLocked: boolean
  party: PartyRef | undefined
}

// The wallet names a party only sometimes, so the hint stands in as the display name. The lock
// rides along because it is the one state that clears the party for good, and every caller
// choosing what to render for a party-less session has to tell it from a read still in flight.
export const useParty = (): UsePartyResult => {
  const { party } = useWalletParty()
  const { isLocked } = useWalletStatus()

  const ref = useMemo<PartyRef | undefined>(
    () =>
      party === undefined
        ? undefined
        : {
            name: party.name ?? partyHint(party.partyId),
            networkId: party.networkId,
            partyId: party.partyId,
          },
    [party],
  )

  return { isLocked, party: ref }
}
