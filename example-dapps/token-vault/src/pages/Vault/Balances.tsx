import { tokenKey, useTokenList } from '@bootnodedev/canton-dappbooster'
import type { Deployment } from '@/backend/deployment'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Card } from '@/components/Card'
import { InfoTip } from '@/components/InfoTip'
import { useTokenFigures } from '@/providers/Tokens'
import { USDX, type VaultToken, VSH } from '@/utils/tokens'

const Figure = ({
  failed,
  label,
  token,
  value,
}: {
  failed: boolean
  label: React.ReactNode
  token: VaultToken
  value: string | undefined
}): React.JSX.Element => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-fg-muted">{label}</span>
    {value === undefined ? (
      <span className="font-mono text-xl font-bold">{failed ? 'N/A' : '…'}</span>
    ) : (
      <AmountDisplay className="text-xl font-bold" token={token} value={value} />
    )}
  </div>
)

export const Balances = ({ deployment }: { deployment: Deployment }): React.JSX.Element => {
  const { byKey } = useTokenList()
  const { failed, vaultBalance } = useTokenFigures()

  return (
    <Card className="flex flex-wrap items-start gap-10 p-5">
      <Figure
        failed={failed}
        label="Your USDX"
        token={USDX}
        value={byKey.get(tokenKey(deployment.underlying))?.balance}
      />
      <Figure
        failed={failed}
        label="Your VSH"
        token={VSH}
        value={byKey.get(tokenKey(deployment.share))?.balance}
      />
      <Figure
        failed={failed}
        label={
          <InfoTip label="The USDX the vault holds, which backs every VSH one for one">
            Vault holdings
          </InfoTip>
        }
        token={USDX}
        value={vaultBalance}
      />
    </Card>
  )
}
