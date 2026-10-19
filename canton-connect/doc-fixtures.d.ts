// Ambient on purpose (no top-level import or export); a loosened type here hides a broken example.

type FixtureNode = import('react').ReactNode
type FixtureElement = import('react').ReactElement

/* Session values a hook hands back */

declare const partyId: string
declare const PARTY: string
declare const account: import('#src/types').Account
declare const error: Error | undefined

/* Consumer-side wiring */

declare const toast: { error: (message: string) => void }
declare const App: () => FixtureElement
declare const children: FixtureNode

/* Kit components a consumer would render, which this package must not import */

declare const ConnectButton: () => FixtureElement

/* Test-suite helpers, for the doubles under src/testing */

declare const render: (ui: FixtureNode) => void

/* Ledger payloads and their decoders, which are the app's rather than this package's */

declare const commands: import('@canton-network/dapp-sdk').PrepareExecuteParams['commands']
declare const toGrant: (createArgument: unknown) => { receiver: string } | undefined
