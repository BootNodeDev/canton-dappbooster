import type { RadioOption } from '#src/components/RadioList'

export const STARTER = 'starter'

/** The examples the dApp list offers, by the name `--example` takes. */
export const EXAMPLES: Record<string, Omit<RadioOption, 'value'>> = {
  'amulet-vesting': {
    label: 'Amulet Vesting',
    hint: 'A vesting dApp frontend and its contracts.',
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
