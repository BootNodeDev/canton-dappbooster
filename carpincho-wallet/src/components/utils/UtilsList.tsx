import { useState } from 'react'
import { type AmuletTapApi, tapAmulet as defaultTapAmulet } from '@/cip56/amuletPreapproval'
import {
  CHEVRON_RIGHT_ICON,
  CONTRACTS_ICON,
  CREATE_ICON,
  DROPLET_ICON,
  EXERCISE_ICON,
  SPINNER_ICON,
  UPLOAD_ICON,
} from '@/components/ui/icons'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { toast } from '@/components/ui/toast'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export type UtilKey = 'create' | 'exercise' | 'contracts' | 'dar'

interface UtilRow {
  key: UtilKey
  icon: JSX.Element
  title: string
  subtitle: string
}

const UTIL_ROWS: UtilRow[] = [
  {
    key: 'create',
    icon: CREATE_ICON,
    title: 'Create contract',
    subtitle: 'Submit a CreateCommand',
  },
  {
    key: 'exercise',
    icon: EXERCISE_ICON,
    title: 'Exercise choice',
    subtitle: 'Call a choice on a contract',
  },
  {
    key: 'contracts',
    icon: CONTRACTS_ICON,
    title: 'Active contracts',
    subtitle: 'Browse & filter the ACS',
  },
  { key: 'dar', icon: UPLOAD_ICON, title: 'Upload DAR', subtitle: 'Install a .dar archive' },
]

const ROW_CLASS =
  'flex w-full items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left ' +
  'outline-none transition-colors enabled:hover:border-primary/60 enabled:hover:bg-primary-soft/40 ' +
  'focus-visible:shadow-focus disabled:opacity-70'
const ICON_WRAP_CLASS = 'grid size-9 shrink-0 place-items-center rounded-full bg-muted text-primary'

interface UtilsListProps {
  account: AccountPublic
  tapApi?: AmuletTapApi
  onSelect: (util: UtilKey) => void
}

// Utils landing: a faucet action row plus drill-in rows for the ledger tools.
export const UtilsList = ({ account, tapApi, onSelect }: UtilsListProps): JSX.Element => {
  const vault = useVault()
  const [tapping, setTapping] = useState(false)
  const tap = tapApi?.tapAmulet ?? defaultTapAmulet

  const onTap = async (): Promise<void> => {
    setTapping(true)
    const progressId = toast.info('Tapping 100 AMT...')
    try {
      await tap({
        account,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      toast.dismiss(progressId)
      toast.success('Tapped 100 AMT')
    } catch (err) {
      toast.dismiss(progressId)
      toast.error(err instanceof Error ? err.message : 'Amulet tap failed')
    } finally {
      setTapping(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-1 pt-3 pb-2">
      <section className="flex flex-col gap-2">
        <SectionLabel>Faucet</SectionLabel>
        <button
          type="button"
          data-testid="utils-tap-amulet"
          className={ROW_CLASS}
          disabled={tapping}
          onClick={() => {
            void onTap()
          }}
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            {tapping ? SPINNER_ICON : DROPLET_ICON}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.94rem] font-semibold text-foreground">Tap Amulet</span>
            <span className="block text-[0.82rem] font-medium text-muted-foreground">
              Get 100 AMT from the faucet
            </span>
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Ledger tools</SectionLabel>
        {UTIL_ROWS.map((row) => (
          <button
            key={row.key}
            type="button"
            data-testid={`utils-${row.key}`}
            className={ROW_CLASS}
            onClick={() => onSelect(row.key)}
          >
            <span
              aria-hidden="true"
              className={ICON_WRAP_CLASS}
            >
              {row.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.94rem] font-semibold text-foreground">
                {row.title}
              </span>
              <span className="block text-[0.82rem] font-medium text-muted-foreground">
                {row.subtitle}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
            >
              {CHEVRON_RIGHT_ICON}
            </span>
          </button>
        ))}
      </section>
    </div>
  )
}
