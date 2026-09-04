// @vitest-environment node

import type { DappSDK } from '@canton-network/dapp-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createActor, type EventObject, fromCallback, fromPromise } from 'xstate'
import { type AccountsInput, readParticipant } from '#src/machine/accountsActors'
import { accountsMachine, type WalletAccounts } from '#src/machine/accountsMachine'
import type { InitInput, RestoreInput } from '#src/machine/connectionActors'
import { connectionMachine, type WalletStatusUpdate } from '#src/machine/connectionMachine'
// Not the '#src/testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a
// DOM.
import { accountsInput } from '#src/testing/accountsInput'
import { connectionInput } from '#src/testing/connectionInput'
import { testParty } from '#src/testing/party'
import { pause } from '#src/testing/pause'

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const party = testParty('alice::1220ab')
const accounts: WalletAccounts = { party }
const pushedParty = testParty('bob::1220cd')

const sessionWith = (accountsLogic: typeof accountsMachine) =>
  connectionMachine.provide({
    actors: {
      init: fromPromise<void, InitInput>(() => Promise.resolve()),
      restore: fromPromise<WalletStatusUpdate, RestoreInput>(() => Promise.resolve({ connection })),
      accounts: accountsLogic,
    },
  })

describe('accountsMachine', () => {
  it('keeps listening across a push, so the root invoke outlives it', async () => {
    const subscribed = vi.fn()
    const unsubscribed = vi.fn()
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.resolve(accounts)),
        accountsEvents: fromCallback<EventObject, AccountsInput>(() => {
          subscribed()
          return () => unsubscribed()
        }),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    actor.send({ type: 'accounts.changed', accounts: { party: undefined } })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.party).toBeUndefined()
    expect(subscribed).toHaveBeenCalledOnce()
    expect(unsubscribed).not.toHaveBeenCalled()

    actor.stop()
  })

  it('takes a push over a read still in flight, which then cannot overwrite it', async () => {
    let finishRead: ((accounts: WalletAccounts) => void) | undefined
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(
          () =>
            new Promise((resolve) => {
              finishRead = resolve
            }),
        ),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()

    expect(actor.getSnapshot().matches('reading')).toBe(true)

    actor.send({ type: 'accounts.changed', accounts: { party: pushedParty } })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.party).toEqual(pushedParty)

    // Leaving `reading` stopped the read, so what it was going to answer is already stale.
    finishRead?.(accounts)
    await pause(0)

    expect(actor.getSnapshot().context.party).toEqual(pushedParty)

    actor.stop()
  })

  // Strip `reading`'s onError and this same rejection reaches the parent as an error event,
  // ending the session: the target is what contains it, which is why `unavailable` exists.
  it('leaves the session standing when the read fails', async () => {
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() =>
          Promise.reject(new Error('no')),
        ),
      },
    })
    const actor = createActor(sessionWith(machine), { input: connectionInput() })

    actor.start()
    actor.send({ type: 'restore' })
    await pause(0)

    expect(actor.getSnapshot().status).toBe('active')
    expect(actor.getSnapshot().matches({ session: 'authenticated' })).toBe(true)
    expect(actor.getSnapshot().children.accounts?.getSnapshot().matches('unavailable')).toBe(true)

    actor.stop()
  })

  it('recovers a failed read when a push arrives, error and all', async () => {
    const unreadable = new Error('no')
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.reject(unreadable)),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().matches('unavailable')).toBe(true)
    expect(actor.getSnapshot().context.error).toBe(unreadable)

    actor.send({ type: 'accounts.changed', accounts })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.party).toEqual(party)
    expect(actor.getSnapshot().context.error).toBeUndefined()

    actor.stop()
  })

  it('types the party once the participant namespace lands, after the read did', async () => {
    let finishParticipant: ((namespace: string | undefined) => void) | undefined
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.resolve(accounts)),
        readParticipant: fromPromise<string | undefined, AccountsInput>(
          () =>
            new Promise((resolve) => {
              finishParticipant = resolve
            }),
        ),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().context.party?.partyType).toBe('unknown')

    finishParticipant?.('1220ab')
    await pause(0)

    expect(actor.getSnapshot().context.party?.partyType).toBe('local')
    expect(actor.getSnapshot().matches('ready')).toBe(true)

    actor.stop()
  })

  it('types a push against a participant namespace already read', async () => {
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => new Promise(() => {})),
        readParticipant: fromPromise<string | undefined, AccountsInput>(() =>
          Promise.resolve('1220ab'),
        ),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    actor.send({ type: 'accounts.changed', accounts: { party: pushedParty } })

    expect(actor.getSnapshot().context.party?.partyType).toBe('external')

    actor.stop()
  })

  it('leaves the party unknown when the participant read yields nothing', async () => {
    const machine = accountsMachine.provide({
      actors: {
        readAccounts: fromPromise<WalletAccounts, AccountsInput>(() => Promise.resolve(accounts)),
        readParticipant: fromPromise<string | undefined, AccountsInput>(() =>
          Promise.resolve(undefined),
        ),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.party).toEqual(party)

    actor.stop()
  })
})

describe('readParticipant', () => {
  const read = async (ledgerApi: DappSDK['ledgerApi']) => {
    const actor = createActor(readParticipant, { input: accountsInput({ ledgerApi }) })

    actor.start()
    await pause(0)

    return actor.getSnapshot().output
  }

  it('resolves the namespace of the participant id the ledger answers', async () => {
    expect(await read(async () => ({ participantId: 'participant::1220ab' }))).toBe('1220ab')
  })

  it('resolves undefined, never rejects, when the wallet refuses the read', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})

    expect(await read(async () => Promise.reject(new Error('no ledgerApi')))).toBe(undefined)
  })

  it('resolves undefined for an answer that is not a participant id', async () => {
    expect(await read(async () => ({ version: '3.4' }))).toBe(undefined)
    expect(await read(async () => ({ participantId: 'malformed' }))).toBe(undefined)
  })
})
