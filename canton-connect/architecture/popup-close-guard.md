# The popup close guard

`guardedConnect.ts` wraps `sdk.connect()` when the SDK's own popup picker is in use. All of it rests
on `dapp-sdk` internals, so this chapter is the why: what the SDK misses, what the guard does, and
where it breaks. The bump procedure it justifies is in [`../CLAUDE.md`](../CLAUDE.md).

## The bug

The SDK's picker attaches `beforeunload` to the popup's `WindowProxy`, and the `about:blank` to
`blob:` navigation that immediately follows destroys the listener. A closed popup therefore left
`connect()` pending forever and bricked the dApp until reload (#49).

## What the guard does

`guardedConnect(sdk)` borrows `window.open` long enough to capture the handle the SDK opens, hands
it straight back, then races the connect against a poll of `popup.closed` that rejects with
`PickerClosedError`, carrying the SDK's own `'User closed the wallet picker'` so `toConnectError`
maps it unchanged. The handle is remembered module-side, because a connect reusing a popup the last
one left open (the normal path for `reuseGlobalWalletPopup` wallets) never calls `window.open`.

Wrapping the call rather than supplying our own `walletPicker` is a stopgap: the picker seam is the
deeper one and the SDK already offers it, but this package holds no picker UI by rule and the themed
one (#50) has no merged implementation.

## The abandoned connect

A rejected race leaves the SDK's `connect()` running, still listening for a picker result and ready
to swap the SDK's client from under the machine's event wiring on the next connect. That is what
`PickerClosedError` is for: `connecting` takes it to `retiring`, which replaces the `DappSDK` and
restores the session from the discovery session key that `connect()` never clears.

Replacing the instance does not by itself reach it. The abandoned `connect()` is parked
inside `core-wallet-ui-components` module scope, on a `message` listener keyed to nothing but our
origin and the message type, so the next successful connect woke every past one: one
`discovery.connect`, and one wallet approval prompt, per popup the user had closed.

`settleAbandonedConnect` drains them at the close instead. It posts the SDK's own
`SPLICE_WALLET_PICKER_RESULT` to our window, the only thing that makes that listener unsubscribe.
The `providerId` matches no registered adapter, so it fails with `WalletNotFoundError`
before reaching a wallet, then rejects out of `waitForWalletPickerRetrySelection` because the popup
is closed. `walletType` stays `'browser'` to keep it out of the branch that registers a remote
adapter from the message, and no `name` is sent, so anything else on the page watching for a pick
can tell the two apart; `dapp/frontend` does exactly that to label its connect button. The drain is
skipped while a second guard is in flight, since the message would resolve that one's live waiter
too.

This is a workaround, not containment: the abandoned connect still runs. The real fix is an abort on
`DappSDK.connect()`, upstream. CIP-0103 has no cancel for a sent `connect` either.

## The watchdog stands down once a wallet is chosen

Past the pick the connect is waiting on the wallet, not the popup, so closing the popup is no longer
a dismissal; treating it as one abandoned a live connect and left an unanswered approval request
behind, one per close. This applies only to `walletType: 'browser'`: for remote and mobile the popup
is the wallet surface, so a close there still strands the connect and must keep rejecting.

The cost is that closing the popup after choosing an extension leaves the button pending until the
wallet answers, with no way to cancel, the same shape as MetaMask's `eth_requestAccounts`.

## How it fails

While the borrow is installed, the first window anything on the page opens is the one watched, so a
connect racing an unrelated `window.open` watches the wrong handle. An SDK that stops reaching for
`window.open` degrades the guard to a bare `sdk.connect()`; that much is pinned headless, since both
provider tests wait on a URL only the SDK's own popup code writes.

The drain and the stand-down have no such backstop. Both rest on the `SPLICE_WALLET_PICKER_RESULT`
message: its type, its origin, and the `walletType` and `providerId` fields, none of it public API.
A rename turns the drain into a no-op that returns the duplicate prompts, and turns the stand-down
back into abandoning a live connect, with nothing going red either way. Nor does any test reach
#49's own cause, a real `WindowProxy` losing its `beforeunload` across the navigation.
