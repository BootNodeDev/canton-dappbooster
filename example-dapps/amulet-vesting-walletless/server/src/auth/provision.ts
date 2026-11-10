import type { WalletFns } from '#server/ledger/wallet'

export const USERNAME = /^[a-z0-9][a-z0-9-]{2,31}$/
export const MIN_PASSWORD = 8

export type Provisioned = { ledgerUserId: string; partyId: string }

export const provisionParty = async (
  ledgerApi: WalletFns['ledgerApi'],
  serviceUser: string,
  username: string,
  stamp = Date.now().toString(36),
): Promise<Provisioned> => {
  // Stamped, so a wiped database never collides with a party left on the ledger by it.
  const name = `wl-${username}-${stamp}`
  const allocated = (await ledgerApi({
    requestMethod: 'post',
    resource: '/v2/parties',
    body: { partyIdHint: name, identityProviderId: '' },
  })) as { partyDetails?: { party?: string } }
  const partyId = allocated.partyDetails?.party
  if (typeof partyId !== 'string' || partyId === '') {
    throw new Error(`the participant allocated no party for ${name}`)
  }
  await ledgerApi({
    requestMethod: 'post',
    resource: '/v2/users/{userId}/rights',
    path: { userId: serviceUser },
    body: {
      userId: serviceUser,
      rights: [{ kind: { CanActAs: { value: { party: partyId } } } }],
      identityProviderId: '',
    },
  })
  return { ledgerUserId: serviceUser, partyId }
}
