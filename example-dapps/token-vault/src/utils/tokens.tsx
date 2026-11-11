import type { TokenMeta } from '@bootnodedev/canton-dappbooster'
import type { ComponentType, SVGProps } from 'react'
import { UsdxMark, VshMark } from '@/icons'

// The app's words and artwork for an instrument; its identity comes off the ledger in `deployment`.
export interface VaultToken extends TokenMeta {
  Mark: ComponentType<SVGProps<SVGSVGElement>>
  name: string
}

export const USDX: VaultToken = {
  Mark: UsdxMark,
  logo: <UsdxMark className="size-full" />,
  name: 'US Dollar X',
  symbol: 'USDX',
}

export const VSH: VaultToken = {
  Mark: VshMark,
  logo: <VshMark className="size-full" />,
  name: 'Vault Share',
  symbol: 'VSH',
}
