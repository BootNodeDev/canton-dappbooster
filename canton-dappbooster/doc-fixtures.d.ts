// The placeholder vocabulary an @example may lean on. `scripts/docs-check.mjs` compiles every
// snippet with this file as a root, so an example may use only what is declared here, and a
// placeholder's type is the real one — a loosened signature here would hide a broken example.
//
// Global on purpose: no top-level import or export, so these are ambient rather than a module.

type FixtureNode = import('react').ReactNode
type FixtureElement = import('react').ReactElement
type FixtureInstrumentId = { admin: string; id: string }
type FixtureToken = {
  balance?: string
  instrumentId: FixtureInstrumentId
  logo?: FixtureNode
  name: string
  symbol: string
}

/* Identifiers and amounts */

declare const partyId: string
declare const cid: string
declare const contractId: string
declare const amount: string
declare const balance: string
declare const receiver: string
declare const storedId: string
declare const label: string

/* Explorer */

declare const explorer: { baseUrl: string }
declare const explorerLink: (
  value: string,
  entity?: 'party' | 'contract' | 'update',
) => string | undefined

/* Clipboard and theme */

declare const state: 'idle' | 'copied' | 'error'
declare const copy: (
  value: string,
) => Promise<{ ok: true; value: string } | { ok: false; error: Error }>
declare const toast: { error: (message: string) => void }
declare const setMode: (mode: 'light' | 'dark' | 'system') => void
declare const lightSheet: string
declare const darkSheet: string

/* Tokens */

declare const instrumentId: FixtureInstrumentId
declare const token: FixtureToken
declare const tokens: readonly FixtureToken[]
declare const mockTokens: readonly FixtureToken[]
declare const selected: FixtureToken

/* Consumer-side handlers */

declare const setAmount: (value: string) => void
declare const setReceiver: (value: string) => void
declare const setSelected: (token: FixtureToken) => void
declare const setError: (error: unknown) => void
declare const toggleMenu: () => void

/* Consumer-side components and host wiring */

declare const App: () => FixtureElement
declare const Page: () => FixtureElement
declare const CantonCoinIcon: () => FixtureElement
declare const CheckIcon: () => FixtureElement
declare const CopyIcon: () => FixtureElement
declare const CopyButton: (props: Record<string, unknown>) => FixtureElement
declare const PartyAvatar: (props: { partyId: string }) => FixtureElement
declare const TokenRow: (props: { token: FixtureToken }) => FixtureElement
declare const children: FixtureNode
declare const el: Element
declare const createRoot: (container: Element) => { render: (node: FixtureNode) => void }
