import { Identifier } from '@bootnodedev/canton-dappbooster'
import { type ReactNode, useEffect, useRef } from 'react'
import type { VaultRequest } from '@/backend/requests'
import { buttonClass } from '@/components/Button'
import { Card } from '@/components/Card'
import { ConnectFace } from '@/components/ConnectFace'
import { EmptyState } from '@/components/EmptyState'
import { Loading } from '@/components/Loading'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Balances } from '@/pages/Vault/Balances'
import { ProposalForm } from '@/pages/Vault/ProposalForm'
import { Requests } from '@/pages/Vault/Requests'
import { useBackend } from '@/providers/Backend'
import { useTokenFigures } from '@/providers/Tokens'
import { useVault, useVaultStore } from '@/store/useVaultStore'

const Fact = ({ children, label }: { children: ReactNode; label: string }): React.JSX.Element => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-2 last:border-0">
    <dt className="w-40 shrink-0 text-sm text-fg-muted">{label}</dt>
    <dd className="min-w-0 text-sm">{children}</dd>
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
    return sessionPending ? (
      <Loading />
    ) : (
      <EmptyState
        level={1}
        title="Canton Vault"
        description="Connect a wallet to deposit USDX for vault shares, or redeem shares for USDX."
        action={
          <ConnectFace
            className={buttonClass('primary', 'lg')}
            cancelClassName={buttonClass('secondary', 'lg')}
          />
        }
      />
    )
  }

  const { share, underlying } = deployment

  return (
    <div className="flex flex-col gap-6">
      <h1 className="border-b border-border pb-4 text-xl font-extrabold tracking-tight text-fg">
        Vault
      </h1>
      <Balances deployment={deployment} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProposalForm backend={backend} deployment={deployment} kind="deposit" partyId={partyId} />
        <ProposalForm backend={backend} deployment={deployment} kind="withdraw" partyId={partyId} />
      </div>
      <Requests backend={backend} partyId={partyId} />
      <Card className="p-5">
        <h2 className="mb-3 text-base font-bold">On the ledger</h2>
        <dl>
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
