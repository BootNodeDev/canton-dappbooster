// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { createActor, type EventObject, fromCallback, fromPromise } from 'xstate'
import type { AccountsInput } from '#src/machine/accountsActors'
import { accountsMachine } from '#src/machine/accountsMachine'
import type { InitInput, RestoreInput } from '#src/machine/connectionActors'
import { connectionMachine, type WalletStatusUpdate } from '#src/machine/connectionMachine'
import { testAccount } from '#src/testing/account'
// Not the '#src/testing' barrel: it re-exports fakeSession, whose Lit-backed SDK import needs a
// DOM.
import { accountsInput } from '#src/testing/accountsInput'
import { connectionInput } from '#src/testing/connectionInput'
import { pause } from '#src/testing/pause'
import type { Account } from '#src/types'

const connection: WalletStatusUpdate['connection'] = { isConnected: true, isNetworkConnected: true }
const account = testAccount('alice::1220ab')
const pushedAccount = testAccount('bob::1220cd')

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
        readPrimaryAccount: fromPromise<Account | undefined, AccountsInput>(() =>
          Promise.resolve(account),
        ),
        accountsEvents: fromCallback<EventObject, AccountsInput>(() => {
          subscribed()
          return () => unsubscribed()
        }),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    actor.send({ type: 'accounts.changed', account: undefined })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.account).toBeUndefined()
    expect(subscribed).toHaveBeenCalledOnce()
    expect(unsubscribed).not.toHaveBeenCalled()

    actor.stop()
  })

  it('takes a push over a read still in flight, which then cannot overwrite it', async () => {
    let finishRead: ((account: Account | undefined) => void) | undefined
    const machine = accountsMachine.provide({
      actors: {
        readPrimaryAccount: fromPromise<Account | undefined, AccountsInput>(
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

    actor.send({
      type: 'accounts.changed',
      account: pushedAccount,
    })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.account).toEqual(pushedAccount)

    // Leaving `reading` stopped the read, so what it was going to answer is already stale.
    finishRead?.(account)
    await pause(0)

    expect(actor.getSnapshot().context.account).toEqual(pushedAccount)

    actor.stop()
  })

  // Strip `reading`'s onError and this same rejection reaches the parent as an error event,
  // ending the session: the target is what contains it, which is why `unavailable` exists.
  it('leaves the session standing when the read fails', async () => {
    const machine = accountsMachine.provide({
      actors: {
        readPrimaryAccount: fromPromise<Account | undefined, AccountsInput>(() =>
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
        readPrimaryAccount: fromPromise<Account | undefined, AccountsInput>(() =>
          Promise.reject(unreadable),
        ),
      },
    })
    const actor = createActor(machine, { input: accountsInput() })

    actor.start()
    await pause(0)

    expect(actor.getSnapshot().matches('unavailable')).toBe(true)
    expect(actor.getSnapshot().context.error).toBe(unreadable)

    actor.send({ type: 'accounts.changed', account })

    expect(actor.getSnapshot().matches('ready')).toBe(true)
    expect(actor.getSnapshot().context.account).toEqual(account)
    expect(actor.getSnapshot().context.error).toBeUndefined()

    actor.stop()
  })
})
