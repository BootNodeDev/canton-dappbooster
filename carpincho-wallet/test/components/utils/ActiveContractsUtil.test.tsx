import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { ActiveContractsUtil } from '@/components/utils/ActiveContractsUtil'
import type { ActiveContract, listActiveContracts as ListFn } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const CONTRACT: ActiveContract = {
  contractId: 'cid-1',
  templateId: 'pkg:Module:Template',
  createArgument: { admin: 'alice::party' },
  createdOffset: 42,
}

const OTHER: ActiveContract = {
  contractId: 'cid-other',
  templateId: 'pkg:Module:Other',
  createArgument: { admin: 'alice::party' },
  createdOffset: 43,
}

const renderUtil = (listActiveContracts: typeof ListFn): void => {
  render(
    <TooltipProvider>
      <ActiveContractsUtil
        account={ACCOUNT}
        listActiveContracts={listActiveContracts}
      />
    </TooltipProvider>,
  )
}

describe('ActiveContractsUtil', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('auto-loads contracts on mount and reveals the details on demand', async () => {
    const listActiveContracts = (async () => [CONTRACT]) as typeof ListFn
    renderUtil(listActiveContracts)

    await screen.findByText('cid-1')
    await userEvent.click(screen.getByRole('button', { name: /toggle contract details/i }))
    await screen.findByText(/admin/)
    // The contract id is shown as a labelled field, like Template and Offset.
    assert.ok(screen.getByText('Contract ID'))
  })

  it('filters the list locally by template or contract id as you type', async () => {
    const listActiveContracts = (async () => [CONTRACT, OTHER]) as typeof ListFn
    renderUtil(listActiveContracts)
    await screen.findByText('cid-1')
    await screen.findByText('cid-other')

    // Template suffix match keeps only the contract whose template ends with the typed name.
    await userEvent.type(screen.getByLabelText('Filter contracts'), 'Other')
    assert.equal(screen.queryByText('cid-1'), null)
    assert.ok(screen.getByText('cid-other'))

    // A contract-id substring narrows it the other way.
    await userEvent.clear(screen.getByLabelText('Filter contracts'))
    await userEvent.type(screen.getByLabelText('Filter contracts'), '-1')
    assert.ok(screen.getByText('cid-1'))
    assert.equal(screen.queryByText('cid-other'), null)

    await userEvent.clear(screen.getByLabelText('Filter contracts'))
    assert.ok(screen.getByText('cid-1'))
    assert.ok(screen.getByText('cid-other'))
  })

  it('re-fetches the snapshot when the refresh button is pressed', async () => {
    let calls = 0
    const listActiveContracts = (async () => {
      calls += 1
      return [CONTRACT]
    }) as typeof ListFn
    renderUtil(listActiveContracts)

    await screen.findByText('cid-1')
    await waitFor(() => assert.equal(calls, 1))

    const button = screen.getByRole('button', { name: 'Refresh contracts' })
    await userEvent.click(button)
    // The icon spins on click, independent of how fast the fetch resolves.
    assert.ok(button.querySelector('.animate-spin-fast'))
    await waitFor(() => assert.equal(calls, 2))
  })

  it('keeps the icon spinning until the fetch settles, then stops on the next turn', async () => {
    let calls = 0
    let resolveRefresh: (contracts: ActiveContract[]) => void = () => {}
    const listActiveContracts = (() => {
      calls += 1
      if (calls === 1) return Promise.resolve([CONTRACT])
      return new Promise<ActiveContract[]>((resolve) => {
        resolveRefresh = resolve
      })
    }) as typeof ListFn
    renderUtil(listActiveContracts)

    await screen.findByText('cid-1')
    const button = screen.getByRole('button', { name: 'Refresh contracts' })
    await userEvent.click(button)
    await waitFor(() => assert.equal((button as HTMLButtonElement).disabled, true))

    // A full turn while the fetch is still in flight does not stop the spin.
    fireEvent.animationIteration(button.querySelector('.animate-spin-fast') as Element)
    assert.ok(button.querySelector('.animate-spin-fast'))

    // Once the fetch settles, the next completed turn ends the spin.
    resolveRefresh([CONTRACT])
    await waitFor(() => assert.equal((button as HTMLButtonElement).disabled, false))
    fireEvent.animationIteration(button.querySelector('.animate-spin-fast') as Element)
    await waitFor(() => assert.equal(button.querySelector('.animate-spin-fast'), null))
  })

  it('messages the loading, empty, and no-match states', async () => {
    const pending = (() => new Promise<ActiveContract[]>(() => {})) as typeof ListFn
    renderUtil(pending)
    assert.ok(screen.getByText(/loading active contracts/i))
    cleanup()

    const none = (async () => []) as typeof ListFn
    renderUtil(none)
    await screen.findByText(/no active contracts/i)
    cleanup()

    const one = (async () => [CONTRACT]) as typeof ListFn
    renderUtil(one)
    await screen.findByText('cid-1')
    await userEvent.type(screen.getByLabelText('Filter contracts'), 'Nope')
    assert.ok(screen.getByText(/no contracts match/i))
  })
})
