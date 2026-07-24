import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Reads HomeView source without importing WalletConnect runtime dependencies into this layout test.
const source = (): string => readFileSync('src/views/HomeView.tsx', 'utf8')

// Reads the extracted pending-actions section so its layout contract can be checked in isolation.
const pendingActionsSectionSource = (): string =>
  readFileSync('src/views/home/PendingActionsSection.tsx', 'utf8')

// Reads the extracted pending-actions hook that owns the prepare → sign → execute → record pipeline.
const pendingActionsSource = (): string =>
  readFileSync('src/views/home/usePendingActions.ts', 'utf8')

// Reads the approval card source so the pending-request layout contract can be checked in isolation.
const pendingActionCardSource = (): string =>
  readFileSync('src/components/ui/PendingActionCard.tsx', 'utf8')

describe('HomeView account body layout', () => {
  // The empty-account state is unreachable: onboarding owns the 0-account case and the
  // last account cannot be removed, so HomeView always renders with at least one account.
  it('no longer carries an empty-account centering branch', () => {
    const homeView = source()
    assert.doesNotMatch(homeView, /hasAccounts/)
    assert.doesNotMatch(homeView, /min-h-\[calc\(100vh-10rem\)\] justify-center/)
  })

  it('delegates account add/switch to the AccountsDialog rendered by AccountCard', () => {
    const homeView = source()
    assert.match(homeView, /<AccountCard/)
    assert.doesNotMatch(homeView, /<CreateAccountForm/)
    const accountsDialog = readFileSync('src/components/AccountsDialog.tsx', 'utf8')
    assert.match(
      accountsDialog,
      /import \{ CreateAccountForm \} from '@\/components\/CreateAccountForm'/,
    )
    assert.match(accountsDialog, /<CreateAccountForm/)
  })

  it('shows the pending approval in a centered dialog rather than the body', () => {
    const homeView = source()
    assert.match(homeView, /title="Awaiting approval"/)
    assert.match(homeView, /<PendingActionsSection/)
    // The section no longer owns the body with its own success-bordered card.
    const pendingActionsSection = pendingActionsSectionSource()
    assert.doesNotMatch(pendingActionsSection, /border-success\/55/)
  })
})

describe('HomeView transaction activity recording', () => {
  // Scenario group: executed transactions should persist both the signed payload source and readable command input.
  it('records prepared transaction bytes and original commands for activity history', () => {
    // Scenario: after Canton prepares and executes a transaction, Activity needs audit data beyond the hash.
    const pendingActions = pendingActionsSource()

    // The prepared transaction is the base64 payload that produced the signed hash, so it must be retained.
    assert.match(pendingActions, /preparedTransaction: prepared\.preparedTransaction/)

    // The original command array is the readable dApp request data shown in Activity.
    assert.match(pendingActions, /commands: transactionCommands\(pendingExecute\.params\)/)
  })
})

describe('PendingActionCard approval layout', () => {
  // Scenario: pending Canton requests need a compact payload area with a label and one framed text box.
  it('renders payload under the payload label in a scrollable tree view', () => {
    // The approval card source is inspected directly because this layout rule is component-local.
    const pendingActionCard = pendingActionCardSource()

    // Payload should not reuse JsonPreview because that primitive adds its own framed preview box.
    assert.doesNotMatch(pendingActionCard, /JsonPreview/)

    // The payload label stays visually aligned with the method row; JsonView owns the scrollable frame.
    assert.match(pendingActionCard, /payload:/)
    assert.match(pendingActionCard, /JsonView/)
    assert.match(pendingActionCard, /max-h-\[40vh\]/)
  })
})
