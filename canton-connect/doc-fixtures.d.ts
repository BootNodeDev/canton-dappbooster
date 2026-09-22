// The placeholder vocabulary an @example may lean on. `kit/docs-check.mjs` compiles every
// snippet with this file as a root, so an example may use only what is declared here, and a
// placeholder's type is the real one — a loosened signature here would hide a broken example.
//
// Global on purpose: no top-level import or export, so these are ambient rather than a module.

type FixtureNode = import('react').ReactNode
type FixtureElement = import('react').ReactElement

/* Session values a hook hands back */

declare const partyId: string
declare const operator: string
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

/* Ledger command payloads, which are the app's rather than this package's */

declare const commands: import('@canton-network/dapp-sdk').PrepareExecuteParams['commands']

/* Hook results a utility example composes with */

declare const activeContracts: import('#src/hooks/useLedger').UseLedgerResult['activeContracts']
declare const activeContractsByInterface: import('#src/hooks/useLedger').UseLedgerResult['activeContractsByInterface']
declare const transactions: import('#src/hooks/useLedger').UseLedgerResult['transactions']
declare const transaction: import('#src/hooks/useLedger').UseLedgerResult['transaction']
declare const lastPage: import('#src/transactions').Transaction[]
declare const tx: import('@canton-network/dapp-sdk').PrepareExecuteAndWaitResult['tx']
declare const execute: import('#src/hooks/useExecute').UseExecuteResult['execute']
