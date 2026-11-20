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
  note,
  token,
  value,
}: {
  failed: boolean
  label: React.ReactNode
  note: string
  token: VaultToken
  value: string | undefined
}): React.JSX.Element => (
  <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 first:pt-0 sm:block sm:border-0 sm:py-0">
    <div className="text-[0.85rem] font-semibold text-fg-muted">{label}</div>
    {value === undefined ? (
      <span className="font-num text-2xl font-semibold sm:mt-1.5">{failed ? 'N/A' : '…'}</span>
    ) : (
      <AmountDisplay
        className="text-lg font-semibold tracking-tight sm:mt-1.5 sm:text-2xl"
        markSize="small"
        token={token}
        value={value}
      />
    )}
    <div className="mt-1 text-xs text-fg-soft max-sm:hidden">{note}</div>
  </div>
)

const percent = (part: string | undefined, whole: string | undefined): number =>
  part !== undefined && whole !== undefined && Number(whole) > 0
    ? (Number(part) / Number(whole)) * 100
    : 0

// The shares lead, since they are the reader's position; the bar shows their slice of the vault.
export const Balances = ({ deployment }: { deployment: Deployment }): React.JSX.Element => {
  const { byKey } = useTokenList()
  const { failed, vaultBalance } = useTokenFigures()
  const usdx = byKey.get(tokenKey(deployment.underlying))?.balance
  const shares = byKey.get(tokenKey(deployment.share))?.balance
  const slice = percent(shares, vaultBalance)

  return (
    <section
      aria-label="Your position"
      className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="flex flex-col justify-between gap-7 overflow-hidden rounded-card border border-[var(--hero-border)] bg-[image:var(--hero-bg)] px-6 py-6 text-[var(--hero-fg)] shadow-[var(--hero-shadow)] sm:px-7">
        <div>
          <div className="text-sm font-semibold text-[var(--hero-muted)]">Your vault shares</div>
          {shares === undefined ? (
            <span className="mt-3 block font-num text-[2.4rem] leading-none font-semibold sm:text-[3rem]">
              {failed ? 'N/A' : '…'}
            </span>
          ) : (
            <AmountDisplay
              className="mt-3 text-[2.4rem] leading-none font-semibold tracking-tight text-[var(--hero-figure)] sm:text-[3rem]"
              markSize="small"
              token={VSH}
              value={shares}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-[var(--hero-muted)]">
          <span>Redeemable one for one for {USDX.symbol}</span>
          <span>
            <b className="font-semibold text-[var(--hero-fg)] tabular-nums">{slice.toFixed(2)}%</b>{' '}
            of the vault
          </span>
        </div>
      </div>

      <Card className="flex flex-col justify-between gap-6 px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid sm:grid-cols-2 sm:gap-4">
          <Figure
            failed={failed}
            label={`Your ${USDX.symbol}`}
            note="Ready to deposit"
            token={USDX}
            value={usdx}
          />
          <Figure
            failed={failed}
            label={
              <InfoTip
                label={`The ${USDX.symbol} the vault holds, which backs every ${VSH.symbol} one for one`}
              >
                Vault holdings
              </InfoTip>
            }
            note={`The ${USDX.symbol} backing every ${VSH.symbol}`}
            token={USDX}
            value={vaultBalance}
          />
        </div>
        <div>
          <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bar-track)]">
            <span className="bg-[var(--vsh)]" style={{ width: `${slice}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8rem] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--vsh)]" />
              Your shares
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-[var(--bar-track)]" />
              Other holders
            </span>
          </div>
        </div>
      </Card>
    </section>
  )
}
