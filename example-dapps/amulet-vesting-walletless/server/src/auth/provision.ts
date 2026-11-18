import type { LedgerApi, LedgerApiParams } from '#server/ledger/wallet'

export const USERNAME = /^[a-z0-9][a-z0-9-]{2,31}$/
export const MIN_PASSWORD = 8

const rightsRequest = (
  requestMethod: 'post' | 'patch',
  serviceUser: string,
  partyIds: string[],
): LedgerApiParams => ({
  requestMethod,
  resource: '/v2/users/{user-id}/rights',
  path: { 'user-id': serviceUser },
  body: {
    userId: serviceUser,
    rights: partyIds.map((party) => ({ kind: { CanActAs: { value: { party } } } })),
    identityProviderId: '',
  },
})

export const provisionParty = async (
  ledgerApi: LedgerApi,
  serviceUser: string,
  username: string,
  stamp = Date.now().toString(36),
): Promise<string> => {
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
  await ledgerApi(rightsRequest('post', serviceUser, [partyId]))
  return partyId
}

// A right the user no longer holds revokes cleanly, so a wiped ledger needs no special case.
export const releaseParties = async (
  ledgerApi: LedgerApi,
  serviceUser: string,
  partyIds: string[],
): Promise<void> => {
  await ledgerApi(rightsRequest('patch', serviceUser, partyIds))
}
