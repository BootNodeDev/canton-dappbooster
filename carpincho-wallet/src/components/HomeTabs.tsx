import { useCallback, useMemo, useState } from 'react'
import { ActivityPanel } from '@/components/ActivityPanel'
import { AssetsPanel } from '@/components/AssetsPanel'
import type { Cip56SendApi } from '@/components/SendTokenForm'
import { UtilsPanel } from '@/components/UtilsPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic, TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  account?: AccountPublic
  transactions: TransactionRecord[]
  tokensApi?: Cip56HoldingsApi
  transfersApi?: Cip56TransferApi
  preapprovalApi?: AmuletPreapprovalApi
  sendApi?: Cip56SendApi
}

// The only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body; assets, activity, and dev tools each own a tab. Pending transfers
// fold into Activity, which badges incoming receiver-acceptance work.
export const HomeTabs = ({
  account,
  transactions,
  tokensApi,
  transfersApi,
  preapprovalApi,
  sendApi,
}: HomeTabsProps): JSX.Element => {
  const activeAccountId = account?.id
  const [pendingTransferState, setPendingTransferState] = useState<{
    accountId: string | undefined
    count: number
  }>({ accountId: undefined, count: 0 })
  const pendingTransferCount =
    pendingTransferState.accountId === activeAccountId ? pendingTransferState.count : 0
  const onPendingTransferCountChange = useCallback(
    (count: number) => {
      setPendingTransferState({ accountId: activeAccountId, count })
    },
    [activeAccountId],
  )
  const activeTransactions = useMemo(
    () =>
      account === undefined
        ? transactions
        : transactions.filter(
            (tx) => tx.accountId === account.id || tx.partyId === account.partyId,
          ),
    [account, transactions],
  )

  return (
    <Tabs
      defaultValue="assets"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList>
        <TabTrigger
          value="assets"
          testId="tab-assets"
        >
          Assets
        </TabTrigger>
        <TabTrigger
          value="activity"
          testId="tab-activity"
        >
          <span>Activity</span>
          {pendingTransferCount > 0 ? (
            <span className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[0.72rem] leading-5 text-primary-foreground">
              {pendingTransferCount}
            </span>
          ) : null}
        </TabTrigger>
        <TabTrigger
          value="utils"
          testId="tab-utils"
        >
          Utils
        </TabTrigger>
      </TabsList>
      <TabContent
        forceMount
        value="assets"
        className={TAB_CONTENT_CLASS}
      >
        <AssetsPanel
          account={account}
          api={tokensApi}
          sendApi={sendApi}
          preapprovalApi={preapprovalApi}
        />
      </TabContent>
      <TabContent
        forceMount
        value="activity"
        className={TAB_CONTENT_CLASS}
      >
        <ActivityPanel
          account={account}
          transactions={activeTransactions}
          api={transfersApi}
          onPendingCountChange={onPendingTransferCountChange}
        />
      </TabContent>
      <TabContent
        value="utils"
        className={TAB_CONTENT_CLASS}
      >
        <UtilsPanel account={account} />
      </TabContent>
    </Tabs>
  )
}
