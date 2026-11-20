import { Identifier } from '@bootnodedev/canton-dappbooster'
import { type ReactNode, useEffect, useRef } from 'react'
import type { VaultRequest } from '@/backend/requests'
import { Card } from '@/components/Card'
import { Loading } from '@/components/Loading'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Balances } from '@/pages/Vault/Balances'
import { ConnectPrompt } from '@/pages/Vault/ConnectPrompt'
import { ProposalForm } from '@/pages/Vault/ProposalForm'
import { Requests } from '@/pages/Vault/Requests'
import { useBackend } from '@/providers/Backend'
import { useTokenFigures } from '@/providers/Tokens'
import { useVault, useVaultStore } from '@/store/useVaultStore'

const Fact = ({ children, label }: { children: ReactNode; label: string }): React.JSX.Element => (
  <div className="min-w-0">
    <dt className="text-[0.8rem] font-semibold text-fg-muted">{label}</dt>
    <dd className="mt-1.5 min-w-0 text-sm">{children}</dd>
  </div>
)

// Funding locks a balance and a settle moves it; a proposal moves nothing until it is a request.
const signatureOf = (requests: readonly VaultRequest[]): string =>
  requests.map((request) => `${request.contractId}:${request.allocated}`).join('|')

export const Vault = (): React.JSX.Element => {
  useDocumentTitle('Vault')
  const { deployment, sessionPending } = useBackend()
  const { backend, partyId } = useVault()
  const loaded = useVaultStore((state) => state.loaded)
  const requests = useVaultStore((state) => state.requests)
  const { refresh: refreshFigures } = useTokenFigures()
  const signature = signatureOf(requests)
  const seen = useRef<string>(undefined)

  // On a change only: a figure blanks while it is read, so a read per tick would flash it.
  useEffect(() => {
    // The first read after a load or a party switch only records: the figures were just read.
    if (!loaded) {
      seen.current = undefined
      return
    }
    const previous = seen.current
    seen.current = signature
    if (previous !== undefined && previous !== signature) {
      refreshFigures()
    }
  }, [loaded, refreshFigures, signature])

  if (deployment === undefined || backend === undefined || partyId === undefined) {
    return sessionPending ? <Loading /> : <ConnectPrompt />
  }

  const { share, underlying } = deployment

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-[1.75rem] leading-tight font-extrabold text-fg sm:text-[1.9rem]">
          Vault
        </h1>
        <p className="mt-1.5 max-w-[56ch] text-fg-muted">
          Deposit {underlying.symbol} to mint vault shares, or withdraw shares to get{' '}
          {underlying.symbol} back. Both settle one for one.
        </p>
      </div>
      <Balances deployment={deployment} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ProposalForm backend={backend} deployment={deployment} partyId={partyId} />
        <Requests backend={backend} partyId={partyId} />
      </div>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-heading text-base font-bold text-fg">On the ledger</h2>
          <span className="text-[0.8rem] text-fg-muted">What this app reads and writes</span>
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Vault party">
            <Identifier value={deployment.vault} label="vault party id" />
          </Fact>
          <Fact label="Vault contract">
            <Identifier value={deployment.vaultCid} label="vault contract id" />
          </Fact>
          <Fact label="Vault package">
            <Identifier value={deployment.vaultPkg} label="vault package id" />
          </Fact>
          <Fact label={`${underlying.symbol} issuer`}>
            <Identifier value={underlying.admin} label={`${underlying.symbol} issuer party id`} />
          </Fact>
          <Fact label={`${underlying.symbol} config`}>
            <Identifier
              value={underlying.config.contractId}
              label={`${underlying.symbol} instrument config id`}
            />
          </Fact>
          <Fact label={`${share.symbol} config`}>
            <Identifier
              value={share.config.contractId}
              label={`${share.symbol} instrument config id`}
            />
          </Fact>
        </dl>
      </Card>
    </div>
  )
}
