import type { RadioOption } from '#src/components/RadioList'

export const STARTER = 'starter'

/** The examples the dApp list offers, by the name `--example` takes. */
export const EXAMPLES: Record<string, Omit<RadioOption, 'value'>> = {
  'amulet-vesting': {
    label: 'Amulet Vesting',
    hint: 'A vesting dApp frontend and its contracts.',
  },
  'amulet-vesting-walletless': {
    label: 'Wallet-less Amulet Vesting',
    hint: 'The Amulet vesting dApp with sign-in accounts instead of a wallet.',
  },
  'token-vesting': {
    label: 'Token Vesting',
    hint: 'A vesting dApp over a canton-token-forge token, with its registry.',
  },
  'token-vault': {
    label: 'Token Vault',
    hint: 'A token vault dApp over a canton-token-forge token: deposit for shares, redeem shares.',
  },
}

/** Every dApp the list offers: the starter first, then the examples. */
export const APPS: RadioOption[] = [
  {
    value: STARTER,
    label: 'Starter dApp',
    hint: 'Barebones, connects to a wallet and gives you a sample contract.',
  },
  ...Object.entries(EXAMPLES).map(([value, example]) => ({ value, ...example })),
]
