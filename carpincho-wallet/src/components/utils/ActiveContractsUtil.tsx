import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { ICON_BUTTON_CLASS, PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible'
import { CopyableLabel } from '@/components/ui/CopyableLabel'
import { DetailRow } from '@/components/ui/DetailRow'
import { CHEVRON_DOWN_ICON, REFRESH_ICON, SEARCH_ICON, X_ICON } from '@/components/ui/icons'
import { JsonView } from '@/components/ui/JsonView'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import {
  type ActiveContract,
  contractMatchesQuery,
  listActiveContracts as defaultList,
} from '@/ledger/contracts'
import { shortMiddle } from '@/utils/account'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

interface ActiveContractsUtilProps {
  account: AccountPublic
  listActiveContracts?: typeof defaultList
}

// One active contract as a collapsible card: a shortened id with a top-right chevron, full
// details (matching the other sheets' field styling) revealed below.
const ContractCard = ({ contract }: { contract: ActiveContract }): JSX.Element => (
  <Collapsible
    data-testid="active-contract"
    className="group rounded-md border border-border bg-surface px-3 py-2.5"
  >
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[0.74rem] leading-5 text-foreground">
        {shortMiddle(contract.contractId, 10, 8)}
      </span>
      <CollapsibleTrigger
        testId="active-contract-toggle"
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:shadow-focus [&_svg]:size-5"
      >
        <span className="sr-only">Toggle contract details</span>
        <span className="transition-transform group-data-[state=open]:rotate-180">
          {CHEVRON_DOWN_ICON}
        </span>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <DetailRow
        label="Contract ID"
        value={contract.contractId}
        copyLabel="contract ID"
      />
      <DetailRow
        label="Template"
        value={contract.templateId}
        copyLabel="template ID"
      />
      {contract.createdOffset === undefined ? null : (
        <DetailRow
          label="Offset"
          value={String(contract.createdOffset)}
          copyLabel="offset"
        />
      )}
      <div>
        <CopyableLabel
          className="mb-1.5"
          label="Create arguments"
          value={JSON.stringify(contract.createArgument, null, 2)}
          copyLabel="create arguments"
        />
        <JsonView value={contract.createArgument} />
      </div>
    </CollapsibleContent>
  </Collapsible>
)

// Browses the active contract set, narrowing it live by template or contract id as you type.
export const ActiveContractsUtil = ({
  account,
  listActiveContracts = defaultList,
}: ActiveContractsUtilProps): JSX.Element => {
  const [filterQuery, setFilterQuery] = useState('')
  const [contracts, setContracts] = useState<ActiveContract[]>([])
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      setContracts(await listActiveContracts({ partyId: account.partyId }))
      setLoaded(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }, [account.partyId, listActiveContracts])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = contracts.filter((contract) => contractMatchesQuery(contract, filterQuery))
  const emptyMessage = !loaded
    ? 'Loading active contracts...'
    : contracts.length === 0
      ? 'No active contracts.'
      : 'No contracts match the filter.'

  return (
    <section className="flex flex-col gap-4">
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {SEARCH_ICON}
        </span>
        <TextInput
          id="contract-filter"
          data-testid="contract-filter"
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.currentTarget.value)}
          placeholder="Template or contract id"
          aria-label="Filter contracts"
          className="pl-9 pr-9 font-mono text-[0.9rem]"
        />
        {filterQuery !== '' && (
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            aria-label="Clear filter"
            className={cn(
              PLAIN_ICON_BUTTON_CLASS,
              'absolute right-2 top-1/2 size-6 -translate-y-1/2',
            )}
          >
            {X_ICON}
          </button>
        )}
      </div>
      {error === undefined ? null : <Alert variant="error">{error}</Alert>}
      <div className="flex items-center justify-end">
        <button
          type="button"
          data-testid="contracts-refresh"
          aria-label="Refresh contracts"
          title="Refresh contracts"
          disabled={busy}
          onClick={() => {
            setSpinning(true)
            void refresh()
          }}
          className={cn(ICON_BUTTON_CLASS, 'size-8 rounded-md [&_svg]:size-[1.05rem]')}
        >
          {/* Spin at least one full turn per click, and keep going while a fetch is in flight. */}
          <span
            className={cn('inline-grid place-items-center', spinning && 'animate-spin-fast')}
            onAnimationIteration={() => {
              if (!busy) setSpinning(false)
            }}
          >
            {REFRESH_ICON}
          </span>
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.9rem] font-medium text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="-mx-1 flex h-[15.5rem] flex-col gap-3 overflow-y-auto px-1">
          {visible.map((contract) => (
            <ContractCard
              key={contract.contractId}
              contract={contract}
            />
          ))}
        </div>
      )}
    </section>
  )
}
