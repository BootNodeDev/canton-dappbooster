import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityList } from '@/components/ActivityList'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { TransactionRecord } from '@/vault/types'

const baseTransaction: TransactionRecord = {
  // Vault record written after Canton accepts an execution; the command carries the inspectable values.
  id: 'tx-1',
  accountId: 'account-1',
  accountName: 'Primary',
  partyId: 'primary::namespace',
  network: 'canton:local',
  method: 'prepareExecuteAndWait',
  status: 'executed',
  createdAt: 1_700_000_000_000,
  preparedTransactionHash: 'prepared-hash',
  commandCount: 1,
  summary: 'ExerciseCommand',
}

describe('ActivityList', () => {
  afterEach(() => {
    // Each render owns document state, so cleanup leaves the next scenario with an empty DOM.
    cleanup()
  })

  it('shows an empty message when there is no activity', () => {
    // Scenario: a fresh account has executed nothing, so the tab states the empty condition plainly.
    render(
      <TooltipProvider>
        <ActivityList transactions={[]} />
      </TooltipProvider>,
    )
    assert.ok(screen.getByText('No activity yet'))
  })

  it('opens a detail popup with the stored command payload when a row is clicked', async () => {
    // Scenario: a dApp executed one DAML choice and the user opens the row to inspect the command.
    const user = userEvent.setup()
    const transaction: TransactionRecord = {
      ...baseTransaction,
      preparedTransaction: 'prepared-base64',
      commands: [
        {
          ExerciseCommand: {
            templateId: 'Counter:Counter',
            contractId: 'contract-1',
            choice: 'Increment',
            choiceArgument: { by: 1 },
          },
        },
      ],
    }

    // The collapsed row shows the summary as its title; clicking it opens the detail popup.
    render(
      <TooltipProvider>
        <ActivityList transactions={[transaction]} />
      </TooltipProvider>,
    )
    await user.click(screen.getByText('ExerciseCommand'))

    // The popup exposes the original command JSON so the user can inspect the called choice and values.
    assert.ok(screen.getByText('Command payload'))
    // The dialog title accounts for one occurrence; the JSON tree key is a second.
    // Asserting >= 2 inside the dialog fails if the payload tree never rendered.
    const dialog = screen.getByRole('dialog')
    assert.ok(within(dialog).getAllByText('ExerciseCommand').length >= 2)
  })

  it('shows copy buttons for mono metadata rows', async () => {
    // Scenario: update id, party id, and hash rows each have a trailing copy affordance.
    const user = userEvent.setup()
    const transaction: TransactionRecord = {
      ...baseTransaction,
      updateId: 'update-id-abc',
    }

    render(
      <TooltipProvider>
        <ActivityList transactions={[transaction]} />
      </TooltipProvider>,
    )
    await user.click(screen.getByText('ExerciseCommand'))

    await screen.findByText('Update ID')
    assert.ok(screen.getByRole('button', { name: /Copy Update ID/i }))
    assert.ok(screen.getByRole('button', { name: /Copy Party/i }))
  })

  it('shows the normalized wallet API method in the detail popup', async () => {
    // Scenario: a transaction recorded the internal prepare-and-execute method, but Activity shows the public name.
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <ActivityList transactions={[baseTransaction]} />
      </TooltipProvider>,
    )
    await user.click(screen.getByText('ExerciseCommand'))

    // The detail view avoids leaking the internal prepare step; users recognize the execution as executeAndWait.
    assert.equal(screen.queryByText('prepareExecuteAndWait'), null)
    assert.ok(screen.getByText('executeAndWait'))
  })
})
