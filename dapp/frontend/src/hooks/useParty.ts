import { useParty as useWalletParty } from '@bootnodedev/canton-connect'
import { partyHint } from '@bootnodedev/canton-dappbooster'
import { useMemo } from 'react'

export type PartyRef = { name: string; partyId: string }

export interface UsePartyResult {
  party: PartyRef | undefined
}

// The wallet names a party only sometimes, so the hint stands in as the display name.
export const useParty = (): UsePartyResult => {
  const { party } = useWalletParty()

  const ref = useMemo<PartyRef | undefined>(
    () =>
      party === undefined
        ? undefined
        : { name: party.name ?? partyHint(party.partyId), partyId: party.partyId },
    [party],
  )

  return { party: ref }
}
