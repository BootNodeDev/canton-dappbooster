// The canton-token-forge registry, which is where the InstrumentConfig disclosure every write
// carries comes from. Reading the config off the ledger instead would only work on LocalNet: the
// instrument admin is a third party, so no connected party is a stakeholder of its contract.

import type { DisclosedContract } from '@/backend/wallet'
import { REGISTRY_URL } from '@/utils/config'

export type RegistryInstrument = {
  admin: string
  instrumentId: string
}

// The two halves a command needs: the contract id to exercise, and the resolved template id a
// command must carry, which the package-name filters cannot supply.
export type InstrumentConfigRef = {
  configCid: string
  configTemplateId: string
}

type WireDisclosure = {
  contractId?: string
  createdEventBlob?: string
  synchronizerId?: string
  templateId?: string
}

const advice = (reason: string): Error => new Error(`${reason}, run pnpm run bootstrap`)

// The registry answers a refusal with a status and a JSON `error`, so read both: a stopped service
// is fronted by an html error page, which would otherwise surface as a JSON syntax error.
const call = async <T>(path: string, body?: unknown): Promise<T> => {
  const init = {
    ...(body === undefined
      ? { method: 'GET' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  }
  let response: Response
  try {
    response = await fetch(`${REGISTRY_URL}${path}`, init)
  } catch {
    // A service that is down, a CORS refusal and a mixed-content block all reject alike, as a bare
    // `Failed to fetch` naming neither the registry nor where it was looked for.
    throw new Error(`the registry is unreachable at ${REGISTRY_URL}${path}`)
  }
  const parsed = (await response.json().catch(() => undefined)) as { error?: string } | undefined
  const reason = parsed?.error
  if (reason !== undefined) {
    throw new Error(`the registry refused ${path}: ${reason}`)
  }
  if (!response.ok || typeof parsed !== 'object' || parsed === null) {
    throw new Error(`the registry answered ${response.status} for ${path}`)
  }
  return parsed as T
}

// Once per session, from `loadBackendConfig`. Two calls because /info is CIP-56 registry metadata
// and carries only the admin; the instruments are their own route.
export const fetchInstrument = async (): Promise<RegistryInstrument> => {
  const [info, listing] = await Promise.all([
    call<{ adminId?: string }>('/registry/metadata/v1/info'),
    call<{ instruments?: { id?: string }[] }>('/registry/metadata/v1/instruments'),
  ])
  const instruments = listing.instruments ?? []
  if (info.adminId === undefined) {
    throw new Error('the registry reported no admin party')
  }
  if (instruments.length === 0) {
    throw advice('the registry administers no instrument')
  }
  // The dApp knows exactly one instrument, so picking one of several would render a grant under a
  // symbol that is not its own.
  if (instruments.length > 1) {
    throw new Error(
      `the registry lists more than one instrument (${instruments.map((one) => one.id).join(', ')})`,
    )
  }
  const instrumentId = instruments[0]?.id
  if (instrumentId === undefined) {
    throw advice('the registry listed an instrument with no id')
  }
  return { admin: info.adminId, instrumentId }
}

// Per write, not cached: one round trip against a contract that can be archived underneath us.
// sender === receiver takes the route's `self` branch, whose choice context is the config alone;
// `transferKind` is not read, because the disclosure is the same on every branch.
export const fetchInstrumentConfig = async (
  party: string,
  instrument: RegistryInstrument,
): Promise<
  InstrumentConfigRef & { disclosed: DisclosedContract[]; synchronizerId: string | undefined }
> => {
  const result = await call<{
    choiceContext?: { disclosedContracts?: WireDisclosure[] }
    factoryId?: string
  }>('/registry/transfer-instruction/v1/transfer-factory', {
    choiceArguments: {
      transfer: {
        instrumentId: { admin: instrument.admin, id: instrument.instrumentId },
        receiver: party,
        sender: party,
      },
    },
  })
  const config = (result.choiceContext?.disclosedContracts ?? []).at(0)
  // Defence in depth: the four vesting choices re-derive `expectedAdmin`/`expectedInstrumentId` in
  // Daml regardless, but `tap` exercises directly on the templateId and contract id below, so a
  // pair the disclosure does not vouch for is refused here rather than handed to the wallet.
  if (
    result.factoryId === undefined ||
    config?.contractId === undefined ||
    config.contractId !== result.factoryId ||
    config.createdEventBlob === undefined ||
    config.templateId === undefined ||
    !config.templateId.endsWith(':Canton.TokenForge.Registry:InstrumentConfig')
  ) {
    throw new Error('the registry disclosed no InstrumentConfig for this instrument')
  }
  return {
    configCid: result.factoryId,
    configTemplateId: config.templateId,
    // Rebuilt field by field to drop the wire object's `synchronizerId`, which `submit` stamps from
    // the factory's own deployment instead, assuming the two share one synchronizer. Returned
    // alongside because that same assumption is what makes it the app's network.
    disclosed: [
      {
        templateId: config.templateId,
        contractId: config.contractId,
        createdEventBlob: config.createdEventBlob,
      },
    ],
    synchronizerId: config.synchronizerId,
  }
}

// The app's side of the wrong-network check. Read from the registry rather than off the deployment
// the wallet reads back: a wallet on another network returns no factory at all, so the deployment's
// own synchronizer can only ever agree with it, and the strip would never fire on a first load.
export const fetchAppNetwork = async (party: string): Promise<string | undefined> => {
  const { synchronizerId } = await fetchInstrumentConfig(party, await fetchInstrument())
  return synchronizerId
}
