# Architecture of the vesting dApp

The app's internal seams and the reasoning behind them. What this is and how to run it is in
[`README.md`](README.md); repo-wide rules live in [`../../CLAUDE.md`](../../CLAUDE.md) and the
cross-component picture in [`../../architecture.md`](../../architecture.md).

Everything here follows from one constraint: the wallet is the only way in. It holds the keys, so it
is both the submitter and the reader, and the app never sees a party it is not connected as. Two
interfaces carry that, and every other decision hangs off them.

## Parts

| Path | Role |
|------|------|
| `src/backend/` | The `VestingBackend` interface, `LedgerBackend` (its one implementation), the pure ACS→domain mappers, the command builders, the `WalletFns` seam, `registry.ts`, which asks the canton-token-forge registry for the instrument, the `InstrumentConfig` disclosure and the network it sits on, `config.ts`, which loads the deployment, and `synchronizer.ts`, which reads the networks the wallet's participant is on. |
| `src/providers/` | `Backend` builds the backend from the deployment plus the wallet session and carries the wrong-network state and the vested instrument alongside it; `Tokens` builds the token list from every source and hands it to the kit's `TokenListProvider`, which is why it sits inside `Backend`: the vested instrument's figures are the backend's to report. The theme provider comes from the kit, the session provider from `canton-connect`. |
| `src/hooks/` | `useParty` narrows the `canton-connect` session to what the UI needs, `useConnectErrorToast` gives a rejected connection somewhere to surface, `useWrongNetwork` watches whether the wallet can still reach the app's network, and `useRoleLens` / `useCreateGrant` keep the role lens and the create dialog in the URL. `AppShell` keys React Router's `ScrollRestoration` on the pathname rather than on the default location key, so opening a grant starts at the top of the page while writing one of those params leaves the scroll where it was. |
| `src/store/useVestingStore.ts` | Backend-backed zustand store; actions submit then refresh. |
| `src/utils/` | Pure helpers, `schedule.ts` chief among them, plus `env.ts`, the environment contract `vite.config.ts` validates against, `config.ts`, which reads `REGISTRY_URL` and the other literals that validation left behind, `network.ts`, the rule behind the wrong-network strip, `tokens.tsx`, the artwork and wording this deployment gives the instrument it vests, and `assetList.ts`, which reads the curated token list. `toast.ts` is here too, the one module whose view lives elsewhere: it holds the Ark toaster and the three tone helpers, and `components/Toaster/` renders them. |
| `src/components/` | What two or more places render: the shell, the top bar and its account menu, the footer, the dialogs, and the primitives the pages compose. |
| `src/icons/` | The brand and house marks only, one per file over a shared `Svg` wrapper and re-exported from `index.ts`. Every generic icon comes from `lucide-react`. |
| `src/pages/` | Dashboard, pending grants and grant detail, each a folder whose `index.tsx` is the route and whose siblings are what only that page renders. |
| `src/styles/` | The single stylesheet entry and the app's own tokens. |
| `api/` | Vercel functions, published off the deployed origin. `registry.ts` is the only one, and it forwards three read-only registry routes that `vercel.json` rewrites onto it. Not part of the bundle and not reachable in `pnpm dev`. |

## The two seams

**`VestingBackend`** ([`src/backend/VestingBackend.ts`](src/backend/VestingBackend.ts)) is what the
UI depends on. It speaks grants, pending grants, and claims — never DAML templates, contract payloads,
or transport. `LedgerBackend` satisfies it against the `vesting` DAML package; it is named
for the thing it reaches rather than for that package, so re-pointing it at another model is not a
rename. Because the mappers that turn active-contract rows into domain types live behind this
interface, no component knows the ledger exists.

**`WalletFns`** ([`src/backend/wallet.ts`](src/backend/wallet.ts)) is the narrower one: the two
session calls `LedgerBackend` makes, `execute` and `ledgerApi`, injected as plain functions rather
than implemented by a class. They come straight from `canton-connect`'s `useExecute` and
`useLedger`, which is why they are injected at all: hooks cannot be called from a class, and
`LedgerBackend`'s unit tests need it constructible without React.

Both halves of the pairing are runtime state. The deployment comes from
[`config.ts`](src/backend/config.ts), which assembles it from two sources at once. Off the ledger,
through that same `ledgerApi`: the `vesting-operator::*` party among the connected user's rights,
then an active-contracts read as that operator for the factory, which yields `pkg`, the contract id
and the `createdEventBlob`. And off the registry, through
[`registry.ts`](src/backend/registry.ts), for the instrument's `admin` and `instrumentId`; reading
those off the ledger instead would only work on LocalNet, because the instrument admin is a third
party and no connected party is a stakeholder of its `InstrumentConfig`.

The ledger half cannot go stale against the participant the wallet is pointed at, since nothing
about it is configured. The registry half can: `VITE_REGISTRY_URL` names a separate process
(deployed it names this origin instead, and the function's own `REGISTRY_URL` names the process),
and one still running against a previous bootstrap's admin party answers `/info` with a party this
ledger no longer knows. Missing is a hard error surfaced by `AppShell`, not a fallback: without a
package id there is nothing to query and without the blob there is no factory to disclose. It needs
a session to read through, so it resolves after connect rather than before. That error card offers a
retry, which is the only way back: the registry restarts independently of the session, so a failure
against it outlives neither the party nor the transport that would otherwise re-trigger the load.

## What a write has to carry

Every choice that moves a holding takes a `configCid`: the `InstrumentConfig` of the instrument the
grant is denominated in. It is admin-signed and observer-less, so no connected party is a
stakeholder of it and no ledger read can reach it.
[`registry.ts`](src/backend/registry.ts) asks the canton-token-forge registry on 3013 for it, over
the CIP-56 transfer-factory route with the connected party as both sender and receiver. That takes
the route's `self` branch, whose choice context is the config alone, and the answer carries both
halves a command needs: `factoryId`, the contract id, and a disclosure whose `templateId` is the
resolved one, which the package-name filters cannot supply.

Fetched per write rather than cached, for the reason the Amulet context was: one round trip against
a contract that can be archived underneath us.

The `(admin, instrumentId)` pair the route is asked about is not on the ledger either. The factory
is this repo's own operator, but the instrument admin is a third party, so
[`config.ts`](src/backend/config.ts) learns the pair from the registry's two metadata routes at the
same time as it reads the factory, and carries both in the `Deployment`. `/registry/metadata/v1/info`
is CIP-56 registry metadata and reports only the admin; the instruments are their own route. A
registry administering none, or more than one, is a hard error: this dApp knows exactly one
instrument, so picking one of several would render a grant under a symbol that is not its own.

Where those calls go is `VITE_REGISTRY_URL`. Locally it is the registry itself; a deployed build
sets it to `/api/registry`, [the app's own function](api/registry.ts), because an https
page cannot call a plain-http registry and Node's fetch has no such policy. The function forwards
three routes and refuses the rest: the registry is read-only, but republishing an unknown route on
the product's own domain is a decision rather than a default. `vercel.json`'s SPA catch-all is
scoped away from `/api/` so it cannot answer the route with `index.html`.

The faucet in the account menu taps that same config. `LedgerBackend.tap` exercises
`InstrumentConfig_Tap` for `TAP_AMOUNT` on the contract id and resolved template id the registry
already disclosed, so the button costs no read the app was not making anyway, and the wallet signs
it as the connected party. The choice is nonconsuming on the admin-signed config, which is what
lets a connected wallet tap with nothing else disclosed. The registry publishes an instrument's id,
name, symbol and decimals but never its faucet, and the config carries no readable payload, so the
per-tap cap cannot be read from the app: `TAP_AMOUNT` has to stay at or under the `maxPerTap`
`scripts/bootstrap-vesting.mjs` sets, and above it the choice aborts and the message reaches the
user as the failure toast.

## Telling the user they are on the wrong network

A write fails at the participant when the wallet submits to a network the app's contracts do not
live on, because the factory and `InstrumentConfig` ids do not exist on the ledger the wallet
reaches. Both sides of that are read.
[`registry.ts`](src/backend/registry.ts) carries `fetchAppNetwork`, which returns the
`synchronizerId` the registry stamped on the `InstrumentConfig` disclosure, the network the app's
contracts are on. It reads that from the registry rather than from
[`config.ts`](src/backend/config.ts)'s `synchronizerId` off the factory row, which the deployment
already carries, and the reason is not cost but circularity: the factory row is read through the
connected wallet, so a wallet on another network returns no factory at all and the deployment's own
synchronizer can only ever agree with the wallet. The registry answers over its own HTTP service,
which is what lets the strip fire on a first load. It assumes the registry and the factory share a
synchronizer, the same assumption `submit` already makes when it stamps the factory's onto every
disclosure.
[`synchronizer.ts`](src/backend/synchronizer.ts) reads the other side, the synchronizers the
wallet's own participant is connected to.

The rule in [`src/utils/network.ts`](src/utils/network.ts) is membership rather than equality,
because a participant can be connected to several synchronizers and reaching the app's one is what
decides whether a write lands. A missing side is not a mismatch, or the strip would warn about a read
that has not come back yet. `party.networkId` is not what is compared: CIP-0103 only recommends a
CAIP-2 label, so two wallets may spell one network differently.

The rule reports a verdict and not the ids behind it, because **the strip names the wallet's network
and no target.** That is a limit rather than a choice. `networkId` is the only network name CIP-0103
defines — `Network` is `{ networkId, ledgerApi?, accessToken? }`, with no display name or alias — and
the spec says what a *wallet* answers, so nothing in it names the app's side. Nothing checks either
label against the id it claims to name, and no single source knows both sides: the wallet only knows
the network it is on, and the registry only its own. A strip saying "switch to canton:localnet"
while already claiming to be on it is worse than one naming no target.

One thing to know about the label that is shown: `CantonConnectProvider` defaults `networkId` to
`canton:local` where the wallet reports none, and nothing downstream can tell that default from a
real answer, so a wallet quiet about its network reads as local wherever it actually is. Only a
non-compliant wallet gets there — the spec makes `networkId` required on an account entry, and
canton-connect's own comment says the fallback exists for `createMockAdapter`. It can mislabel the
sentence but never decides whether the strip appears, which is what keeps it acceptable.

[`useWrongNetwork`](src/hooks/useWrongNetwork.ts) is what keeps it current, and it polls because a
wallet-side switch reaches the app through nothing at all: CIP-0103 defines no network-change event
and the SDK pushes accounts only. So it re-reads on three triggers — the party changing, the page
regaining focus, and every 30 seconds. Focus is the one that catches a switch as it happens, since
switching networks means using the wallet and the wallet takes focus; `visibilitychange` misses it,
because an extension popup draws over the tab rather than hiding it. The interval is the backstop for
a switch made in a window the user never comes back from. A failed read is silent and leaves the last
answer standing, because a registry that is down, or a wallet that has just locked, is not a wrong
network.

Only the wallet's side is on that poll. The registry serves one deployment for as long as it is up,
so the app's side is read once and kept, and every later check is a single read of the wallet's
participant. Two of those checks can still be in flight at once (a focus landing mid-interval), so
each carries a sequence number and only the last one started may write. The verdict carries the
party it was read for too, or the previous party's answer would be shown against the new one's
network for as long as the first read for that party takes.
[`WrongNetwork`](src/components/WrongNetwork.tsx) renders the verdict as a strip above the header,
and nothing dismisses it, because only the wallet can put it right.

The verdict also decides what the page itself says. On the wrong network `config.ts` finds no
operator on the ledger the wallet reaches, so it throws its `run pnpm run bootstrap` advice and
[`AppShell`](src/components/AppShell.tsx) would fill the page with it. That message names a symptom:
the deployment is there, the wallet is not looking at it. So where the verdict stands, the card
carries the network instead and the advice is held back for the case it was written for, a ledger
that really has no deployment, where its Try again is worth offering, which is why that button is
shown only off the wrong network.

## Creating a grant takes one approval

`VestingFactory_CreateVesting` splits the funder's inputs itself: it transfers them into one
unlocked holding of exactly the grant, hands the change straight back, and the proposal names that
holding alone. So a grant reserves its own amount and nothing more, and the rest of the funder's
balance stays spendable while the proposal is outstanding. That split is why the choice takes the
`InstrumentConfig`, and it is still one submission and one wallet approval, because an unlocked
self-transfer's controllers are the sender alone. The Amulet version could not do this in one:
`AmuletRules_Transfer` consumes everything it is given, which is why creating a grant used to be two
submissions and two wallet prompts.

The reserved holding is still kept out of the next selection, read off the funder's own
pending-grant rows rather than remembered locally: an Accept consumes exactly that contract, so
spending it would leave the grant permanently unacceptable, `CONTRACT_NOT_FOUND` at the `fetch`
before the transfer even runs. A selection built against a stale read now fails its own submission
rather than creating a second grant on a holding that is already gone.

`createVesting` picks unreserved holdings largest first until they cover the total. Largest rather
than smallest so the factory splits the fewest inputs, no longer for the receiver's sake: the split
leaves one holding to disclose whichever inputs went into it.

A holding is worth its `amount` field and nothing is computed: a token-forge `Token` does not decay,
so unlike an Amulet there is no decayed value to reason about and no headroom to guess at.

Accept is still the one write disclosing something the connected party cannot read for itself: the
holding the grant reserves. `Token` is `signatory admin, owner` with no observers, so the receiver is
no stakeholder. That holding is created by the funder's own create submission, so its blob cannot be
read before it exists: `createVesting` re-reads the funder's holdings with `includeCreatedEventBlob`
once the grant is on the ledger, and keeps in `localStorage` the blob of every holding an
outstanding grant of theirs reserves. Reconciling the whole set rather than only the grant just made
is what lets a read that failed once be repaired later, instead of leaving a grant nobody can
accept; and reading after the write rather than before is what keeps a declined prompt from leaving
a blob behind for a holding no grant is waiting on. A failure there leaves the grant alone, since it
is already on the ledger and reporting one would invite a second, so it is logged and left to the
next reconcile.

`viewAs` runs that same reconcile, which is what makes the repair reachable: a funder who creates
one grant and stops never triggers a second create, and their own dashboard is the only other place
the grant is seen. It costs nothing on the settled path, since the holdings are read only once a
grant of this party's is found to be missing its blob, and it is skipped outright for the grants a
party received rather than funded, whose holdings they could not read anyway.

Which blob a given Accept sends is read off the ledger, not guessed: the receiver is an observer of
the grant, so `accept` fetches it and discloses exactly the `tokenCid` it names, then drops it, since
that submission archived it. Sending the whole store instead would re-disclose holdings earlier
accepts already consumed, which the participant rejects, and grow without bound. It is a
browser-local hand-off between two wallet accounts, which is what the demo
is; a receiver on another machine has no way to disclose it and `accept` says so rather than
submitting a rejection. A grant that has left the receiver's view says something else, because a
stale dashboard and a missing blob are different problems and pointing the first at the blob store
sends the reader to a browser that was never involved.

Accept is no longer the only exit. `VestingProposal_Cancel` and `VestingProposal_Reject` are
bodyless and move no holding, so the funder's cancel and the receiver's decline take neither the
config nor a disclosure: a consuming choice archives on its controller's own authority. Nothing has
to hand the reserved holding back either, since it is an ordinary unlocked `Token` throughout and
`freeTokens` subtracts only what an outstanding proposal names. Both go through one `endProposal`,
which reads the proposal before the write because the blob this browser kept is keyed by the holding
that proposal names, and forgets that blob and its read-miss count after the write, never before: a
prompt the wallet declines leaves a grant that is still acceptable. A grant ended from another
browser still leaves its blob behind, since a stored blob records no owner and one party's view
cannot safely prune another's.

The escrow needs no such hand-off. A `LockedToken` is `signatory admin, owner, holders` and the
escrow's holders are the provider and the receiver, so both ends of a grant can read it. Only the
config is disclosed on withdraw, cancel and residual claim.

A grant, a pending grant and a residual claim each carry `admin` and `instrumentId` as template
fields, so a row from another instrument on a shared participant is dropped before it is mapped. The
proposal stores its pair rather than deriving it, which is what lets the receiver see what a grant is
denominated in: the funder's holdings, which the factory read the pair off, are unreadable to them.

A filter always names a template by package name (`#vesting:Vesting:…`) and a command always by the
resolved id the deployment carries. The participant rejects each in the other's position, the filter
loudly with `INVALID_FIELD`. The one exception is the faucet: `InstrumentConfig_Tap` is exercised on
the config, whose resolved id comes from the registry's disclosure rather than from the deployment.

## Data flow

```
config.ts ────────────┐
                      ├─▶ Backend ──────────▶ useBackend ──▶ useVestingStore ──▶ components
CantonConnectProvider ┤                                                            ▲
                      └─▶ useParty ───────────────────────────────────────────────┘
```

`Backend` ([`src/providers/Backend.tsx`](src/providers/Backend.tsx)) is the
only place the two seams above meet. Its backend is `undefined` until both a deployment and a wallet
*party* exist, because neither half alone can reach the ledger, and a page with no backend renders
`ConnectPrompt` where its data would be. The party rather than the connection status is the gate: a
restored-but-locked session reports itself connected while reporting no party, and the party is what
every read filters on and every submit acts as. The shell holds the pages until the deployment has
resolved either way, so inside a page a missing backend can only mean a missing party — which is
what makes `ConnectPrompt`'s copy, and the kit connect button inside it, correct wherever it
renders — that face never flips to the disconnect one, which is why the prompt takes it rather than
the kit's `WalletButton`. Once an attempt is in flight the connect button is swapped for
`CancelButton`, so one button is on screen at a time and each does one thing only: that button
carries the spinner for the wait and the word for the action. A double-click therefore lands its second click on the cancel and
ends the attempt it just started, which the split makes honest rather than hidden: the button the
user hits says Cancel.

The swap itself is [`ConnectFace`](src/components/ConnectFace.tsx), which the prompt and the top bar
both render, so a third site cannot forget half of it. It is a leaf on purpose: it holds the only
`useConnect` subscription of the two, so an attempt re-renders one button rather than the header or
the empty state around it. It also owns the repair a swap needs — the focused button is the one
being unmounted, so focus falls to `<body>` and the keyboard loses its place. It hands focus to
whichever button took over, and only then: a focus move nobody asked for on first paint would be
worse than the problem.

The session is the other chain, and none of it is this app's. `CantonConnectProvider` owns it, the
kit's `ConnectButton`, `CancelButton` and `DisconnectButton` drive it, and `useParty`
([`src/hooks/useParty.ts`](src/hooks/useParty.ts)) narrows it to the `PartyRef` the UI wants,
standing the party hint in as a display name for the wallets that report none. Nothing else reaches
for a `canton-connect` hook except `ConnectFace` and the error toast, both of which need `isPending`
off `useConnect`. The top bar picks its face itself rather than reaching for the kit's
`WalletButton`, whose disconnect face is a plain button: the connected side here is a dropdown,
`TopBar/AccountMenu`, holding the copyable party id, the network the session is on, and the
disconnect. Everything short of that is `ConnectFace`, so an attempt started from the top bar can be
abandoned there rather than only from the prompt further down the page.
It picks on the party alone, never on `isConnected`: a standing session reports no party while the
account read is in flight, again after it fails, and again once a lock clears it, and the connect
face is the right answer to all three. It renders its own pending copy for the first and retries the
second. For the third it is the only way back, because a lock and a wallet-side disconnect are one
push the app cannot tell apart, and the machine accepts a connect from a standing session for
exactly that reason; a refresh there restores nothing and lands on the same face, so the two agree.
The shell no longer gates on the session: it always mounts, so the top bar's wallet control and the
theme toggle stay reachable, and the wallet's own account switch is the only way the acting party
changes. A connect that fails
reaches the user through
[`useConnectErrorToast`](src/hooks/useConnectErrorToast.ts), because the kit ships no user-facing
copy and would otherwise fail silently; a cancel is a choice, not a failure, and stays quiet, which
the hook reads off `canton-connect`'s `ConnectCancelledError` rather than off a message.

`useVestingStore` takes the resolved backend from `useBackend` and owns the grant data. Every action
submits through the backend and then refreshes; there is no optimistic local mutation, because a
write is only real once the ledger has it and the read is the only thing that knows. It also drops
every row when the party goes, because the rows were that party's.

A contract id is not a grant's identity, which is the one thing a UI keyed on ids has to know here:
`VestingContract_Withdraw` archives the contract and re-creates it with `alreadyWithdrawn`
raised, so a claim changes the id of the grant it acted on. `grantLineage` is that identity —
everything the choice preserves — and it is what the withdraw history keys on and what `withdraw`
uses to hand the grant-detail page its successor's id, so a URL survives a claim rather than
becoming "Grant not found".

A withdraw that drains the escrow is the exception: it creates no successor, because the contract's
`ensure alreadyWithdrawn < totalAmount` is strict and a zero-backing successor would hold a
zero-amount `LockedToken`. So the grant is archived, exactly as `VestingContract_Cancel`
archives it, and the page navigates away for both rather than sitting on an id the next read will
not return. That is why there is no drained-grant state anywhere in the UI: a fully claimed grant
cannot be in the ACS, so nothing can render it. Showing one would mean reconstructing it from the
update stream, and the drain emits no `CreatedEvent` to reconstruct it from.

## Where the numbers come from

`deriveGrant` in [`src/store/useVestingStore.ts`](src/store/useVestingStore.ts) is a pure projection
of a grant at a moment in time — vested, claimable, claimed, status. It and
[`src/utils/schedule.ts`](src/utils/schedule.ts) are the single source of every per-grant figure, and
they mirror the on-ledger math deliberately, so a preview and the choice that follows it agree — the
contracts recompute `vestedAmount` themselves and reject anything above it. A component that
derives a grant's own vesting figures is a bug. `claimAvailable`, beside it, is the same rule for a
residual claim, which carries no schedule and so has no projection of its own: what the dashboard
shows, sums and submits for one is a single subtraction in a single place. Two components
legitimately compute on top of that projection rather than beside it: `MilestoneTimeline` splits a
total across milestone steps for display, and `Dashboard` sums `deriveGrant`'s output into the
KPI row. Both take the projection as their input; neither re-derives it.

Under both sits [`src/utils/amount.ts`](src/utils/amount.ts), the arithmetic floor. Every add,
subtract, floor-at-zero, fraction scale, and round in the app goes through it, on scaled `bigint`s,
and `schedule.ts` builds on it too. Nothing computes an amount any other way.

The invariant it exists to hold: a domain amount is an exact decimal string, never a `number`. A
double cannot round-trip 10 decimal places past about six integer digits, which is well inside the
range this app shows. `number` survives only for ratios, chart geometry, and percentages, and
`toNumber` is the one sanctioned door between the two. Reading an amount into arithmetic through
any other door is the failure this module was written to prevent, and it fails silently. `isAmount`
is the door in: `amountOf` in the backend mappers runs every incoming `Numeric` through it, so an
unparseable string is rejected where it arrives rather than read as zero by the arithmetic
downstream.

## The kit seam

Party ids come from `@bootnodedev/canton-dappbooster`, styled by `@bootnodedev/canton-theme`. The app
holds no truncation or copy-to-clipboard logic of its own.

Entry is the other half. [`CreateGrant`](src/components/CreateGrant/Details.tsx)'s receiver field is
the kit's `<PartyIdInput>`, and the submit gate calls the same `validatePartyId` the field does, so
the two can never disagree about what a party id is. Party ids are exact strings here: nothing
trims, so a stray space is invalid rather than silently stripped on the way to the ledger.

That field is also where the layering is easiest to read. The kit sets `aria-invalid` and hands back
an error *code*; this app owns the sentence, where it sits, and what it looks like. The wording lives
in a `Record<PartyIdError, string>` so a new code added upstream fails the build here instead of
rendering nothing, and the red state is a Tailwind `aria-invalid:` variant rather than
`canton-theme`'s, because the app's utilities sit above the `cnc` layer (see
[`src/styles/index.css`](src/styles/index.css)).

Amounts run that same split twice more. [`CreateGrant`](src/components/CreateGrant/Details.tsx)'s
total and [`Claim`](src/components/Claim.tsx)'s withdrawal are both the kit's
`<TokenInput>`: the field sets `aria-invalid` and reports an error *code*, and this app words it
in [`src/utils/amountErrorText.ts`](src/utils/amountErrorText.ts), again an exhaustive `Record` so a
code added upstream fails the build here.

**The create field offers the picker; the claim dialog does not, and will not.** What a grant pays
out is fixed by the contract, so `Claim` passes `token={DBT}` and no `onTokenSelect`, which is what
makes the kit render the symbol as a static mark rather than a button.

The list behind the picker is real. [`src/providers/Tokens.tsx`](src/providers/Tokens.tsx) reads the
kit's `useHoldings`, groups it with `sumHoldings`, reads the registry's catalogue with
`readInstruments`, and hands the merged result to `TokenListProvider`.

The rows are the union of what every source knows, merged by the kit's `mergeTokens`: the curated
list, then the registries, then the balances, then the app's own artwork. Later sources win field by
field, so the registry has the last word on a label and the curated list supplies the logo it does
not serve. A source that will not answer costs labels and no rows.

**A token the party holds none of is still a row.** The list is a catalogue, and a picker that only
offered what you already hold could never serve a swap's buy side. This form does not filter it
either: picking a token you hold nothing of simply leaves you unable to grant it, which is the
field's own rule to enforce.

**The vested instrument's figures are this app's, not the ledger's.** Its `balance` is what
`balanceOf` reports, what is free to fund a grant, and its `locked` is the escrowed holdings plus
whatever a pending grant has reserved. The three still sum to everything held, so the row hides
nothing; it splits it the way this app can act on. Every other row keeps the ledger's own split.
Which row that is comes from `useBackend().instrument`, the `(admin, instrumentId)` pair the
deployment read off the registry, matched on both halves: a shared participant can hold another
admin's instrument under the same id.

That is also why the create field no longer reads a balance of its own: it takes the row the picker
handed back, so its Max and its ceiling are the figure the row showed. Pick a token you hold none of
and Max is disabled, which is the correct dead end.

A row carries a figure or it does not, so a read that failed looks exactly like one still running.
`useTokenFigures` is what tells them apart: `Tokens` publishes whether either read failed, and the
field turns that into the kit's `balanceState="error"`, which is the `Balance: N/A` face.

Which registries to ask comes from the same curated list: the first URL each entry publishes, plus
`REGISTRY_URL`, the canton-token-forge registry this deployment vests against and the only address a
LocalNet has. Every one of them is read, not only the ones behind a holding, because a catalogue is
the point. Only same-origin ones, though: a registry on another origin sends no CORS headers, so the
browser blocks the read and the curated entry keeps the symbol and logo it already carries.

The token standard's v1 APIs publish no way to find a registry, so every app keeps that mapping
itself. [CIP-0056](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md) is the
proposal to replace it: ask any SV's scan for the CNS entry at `/v0/ans-entries/by-party/<admin>`
and read the registry URL out of the JSON its description carries. It takes an admin party, so it
would answer where to ask about a token already listed and never which tokens exist, and no
LocalNet registers those entries. The curated list stays the source of both.

The curated list is [`assets.json`](https://github.com/canton-network/wallet/blob/main/api-specs/assets.json)
in the Canton wallet repo, read by [`src/utils/assetList.ts`](src/utils/assetList.ts). It lives here
and not in the kit because it is one repository's file rather than a standard: no CIP, no schema, no
versioning, and its shape is whoever maintains it to change. So it is trusted for artwork and for
the symbol it publishes, never for identity or amounts, and the kit ships no reader for it.

`ASSET_LIST_NETWORK` picks a top-level key of that file, and `undefined` skips the source
altogether. The published file covers `MainNet`, `TestNet` and `DevNet` and no LocalNet, so the dev
server serves the whole published list with a `LocalNet` section holding the DevNet entries. This
stack's own instrument is deliberately not written into it: the registry serves that, and a party
in a file would be one developer's and wrong for everyone else after the next `reset`. The list
failing costs labels and nothing else, so a stack that is down still serves one.

[`src/utils/tokens.tsx`](src/utils/tokens.tsx) is down to the artwork, the name and the symbol. It
carries no `instrumentId` at all, because the admin is minted per bootstrap run: the identity comes
from the registry through `useBackend().instrument`, and this is only what the app calls it.

One thing the pick still does not do: **it changes nothing but the field.** The re-lock floor's
wording, the claim toast, `AmountDisplay`'s mark and the grant that gets created all say `DBT` in
their own right, and `createVesting` funds from the vested instrument whatever the picker shows.
Each has to take the chosen token instead, or a pick relabels one field and means nothing.

Both pages re-derive that code with the kit's own `validateAmount` rather than storing the one
`onChange` handed them, because the bounds move on their own: the claim dialog's ceiling is a
live-vesting `claimable` that recomputes each second, and a stored code would keep flagging an
amount the field had already accepted. The field is still the single source of the rule; the app
just asks it again at render time.

The division of labour underneath is the part neither side announces. The kit owns one amount at
one precision: parse, format, sanitize a keystroke, validate against the ledger's own limits and a
`max`. It knows nothing
about a second amount, so everything that combines two of them is this app's, in
[`src/utils/amount.ts`](src/utils/amount.ts), built on the kit's `parseAmount` / `formatScaled` pair and
on nothing else of the kit's. So the field's `balance` is the ceiling, while both floors are the
app's: the create form's `MIN_GRANT_AMOUNT`, and the claim dialog's re-lock floor, which is a rule
about the *remainder* and so about two amounts at once.

The two amounts the floor spans are not the ceiling's. A withdraw re-locks whatever it leaves in the
escrow, and the escrow backs the unvested part of the grant too, so the floor is measured against
`grantBacking` while the ceiling stays `deriveGrant`'s `claimable`. Measuring both against
`claimable` refuses amounts the ledger takes, and offers the last claim before full vesting, which
the ledger aborts on. `grantBacking` sits beside `deriveGrant` rather than inside it, like
`claimAvailable`: it does not move with the clock. A residual claim carries no schedule, so its two
are the same amount and `Claim`'s `backing` prop defaults to `available`.

Both dialogs have a ceiling, and both hand it to the field as `balance`: the claim dialog's is the
grant's own `claimable`, the create form's is whatever figure the picked row carries. So neither
passes `aria-invalid` for the amount — the kit flags anything above the `balance` it was given — and
where a read leaves no figure to give, the selection refuses the amount instead, naming what is
actually free.

A Canton balance is a set of holding contracts rather than a scalar, so the read is party-scoped and
summed. It reports what a grant could actually spend rather than what the party owns, over the same
set `selectHoldings` will draw from: a holding already escrowed is a `LockedToken` and so out by
template, and the one an outstanding grant reserves is out because spending it would leave that
grant unacceptable. The two agreeing is the point: a `Max` that offered more would put an amount in
the field that the next step always refuses. The read belongs to `Tokens` now rather than to the
form, so it runs when the party changes and again whenever the create dialog opens: a grant that
dialog created has reserved a holding since, and the figure it showed before would be the one from
before the grant.

The amount field shows no validation message at all for now, which is why nothing words
`MIN_GRANT_AMOUNT` or a bad decimal to the user; both still gate `Continue`. `AMOUNT_ERROR_TEXT`
stays because the claim dialog renders it.

Which kit export to reach for is decided by the surrounding markup. Where an id is a standalone
element it renders the full `<Identifier>` primitive; where it sits inside a `<button>`, a `<Link>`,
or a sentence it uses the pure `truncateIdentifier` / `partyHint` formatters instead, because
`<Identifier>`'s copy control is itself interactive and cannot nest inside another interactive
element.

No id links out at the moment. `VITE_EXPLORER_URL` names the explorer and nothing else now that the
transfer context has its own endpoint, and no `<Identifier>` is given an `href`, so nothing renders
the kit's external-link affordance and `EXPLORER` is exported for a consumer that does not exist
yet. Restoring it is passing `href={useExplorerLink(EXPLORER)(party)}` again at the call
sites that want it: the kit composes URLs only from an `ExplorerConfig` because Canton has no
canonical explorer, and the href stays a per-call-site decision the way the kit's own is optional.
Counterparty ids go through one component:
[`src/components/CounterpartyId.tsx`](src/components/CounterpartyId.tsx) binds the from/to prefix
and the direction-specific label, and `GrantCard` and `PendingGrantCard` render it. A copy raises
no toast: the icon swapping to a tick is the confirmation, and the kit's own live region announces
it, which is why no `<Identifier>` here turns `announce` off. The toast region stays where it
mounts, which takes one arrangement with the
dialog: Ark's `Dialog` aria-hides everything outside its own content but skips any element carrying
`aria-live`, and the toast region carries one, so a toast raised over an open dialog — every failed
submit — is still announced. Clicks are the other half. A modal dialog blocks the pointer outside
itself and reads a click there as a dismissal, so `Modal` names the region in Ark's
`persistentElements`, and `utils/toast.ts` exports the lookup that finds it by the id Zag gives it.

That literal is the build's doing. [`vite.config.ts`](vite.config.ts) runs
`parseEnv(loadEnv(...))` and `define`s the parsed values back onto `import.meta.env`, so a bad
`VITE_EXPLORER_URL` fails the build rather than the page load and the client ships no validator at
all. [`src/utils/env.ts`](src/utils/env.ts) holds that contract, and is the only module under `src/`
that runs outside the browser. The `.env` it reads is the repo root's, the one file the monorepo
keeps, and it is loaded with an empty prefix — every key in it, `CANTON_AUTH_SECRET` included — so
only what `parseEnv` returns may be defined back. Spreading the loaded object would put the signing
secret in the bundle.

The connect button's copy is the kit's: passed no `children` it renders its own label and swaps it
for "Connecting…" while a connect is in flight, so neither `ConnectPrompt` nor `TopBar` supplies one.
An app-side label meant duplicating the pending state, which is what the earlier `useConnectLabel`
did by listening for the SDK picker's private `SPLICE_WALLET_PICKER_RESULT` message.

Theme is the kit's too. `ThemeProvider` in `App.tsx` applies `data-theme` to `<html>` on the kit's
default storage key, and [`src/styles/tokens.css`](src/styles/tokens.css) keys the app's own
`--fg` / `--bg` set off the same attribute. The reload flash that comes with that, and why no
pre-paint script sits in `index.html`, are the kit's call:
[`canton-dappbooster/architecture.md`](../../canton-dappbooster/architecture.md).

## Where the widgets come from

Every menu, dialog, tooltip, select, toast, stepper, number input and progress bar is
[Ark UI](https://ark-ui.com/react/docs/overview/introduction), and every generic icon is
`lucide-react`. Ark wraps the same `@zag-js/*` machines `canton-dappbooster` already depends on and
pins them to the exact version the kit resolves, so the lock file holds one copy of each rather than
two. What the app still writes is the classes and the wording; what it stopped writing is
dismissal, focus trapping, roving focus, live-region announcement and popper placement.

`canton-dappbooster` stays on raw Zag. Its anatomy class strings are what `canton-theme` selects
against, and Ark ships its own.

Three things the library leaves to the caller, settled once here:

- **A popper's z-index goes on its `Content`, never its `Positioner`.** Zag reads the content's
  computed `z-index` and writes it onto the positioner as an inline `z-index: var(--z-index)`, so a
  class on the positioner loses to that inline style and the panel lands on `auto`.
- **A popper opened inside `Modal` renders inline with `strategy: 'fixed'` rather than in a
  `Portal`.** A portal would put the panel outside the dialog, where Ark aria-hides it and blocks
  the pointer. Fixed positioning is what frees it from the dialog's own scroll box without leaving
  the dialog.
- **`InfoTip` opens on tap.** Zag's tooltip ignores touch pointers by design, so the component adds
  a `pointerup` toggle for `pointerType === 'touch'` and turns `closeOnClick` off, or the click that
  follows the tap closes what the tap opened.
- **`Modal` refuses a focus-outside dismissal.** Ark closes a dismissable layer once focus lands
  outside it, and a modal dialog only ever gets that by accident: mounting is what opens ours, so
  no `Dialog.Trigger` is registered for Ark to exclude, and the focus trap handing focus back to
  the button that opened it reads as an interaction outside. Under React's development remount
  that happens on the way in, and the dialog shuts the moment it opens. A press outside and Escape
  still close it.

The toast stack is the one Ark part that needs CSS the app has to supply: Zag places each toast
absolutely and hands the offsets over as custom properties, so
[`src/styles/index.css`](src/styles/index.css) turns them into a `translate` and a transition. With
no rule there every toast draws on top of the one before it.

## Stylesheet layering

[`src/styles/index.css`](src/styles/index.css) is the single entry. Its leading
`@layer properties, theme, base, cnc, components, utilities` is declared before the first `@import`,
which is what puts the kit theme's `cnc` layer above Tailwind's preflight and below the app's
utilities: above preflight because preflight resets `button { color: inherit }` over the kit's copy
control, below `utilities` so a `className` on a kit component still wins. Moving that line under an
import silently reorders the cascade, and a layer left off the list lands on top of every layer that
is on it, so the list is worth rereading on a Tailwind major bump.

The app carries its own preflight restorations in `base` too, currently `cursor: pointer` on enabled
buttons, which Tailwind v4's preflight dropped. `base` is the right layer for them because
`utilities` comes later in the list, so a `cursor-*` utility on the element still wins; unlayered
they would outrank every utility and every `cnc` rule whatever the specificity.

[`src/styles/tokens.css`](src/styles/tokens.css) holds the app's Tailwind-facing colour names, which
`@theme inline` in the entry turns into utilities. `inline` is what keeps those utilities pointing at
the live custom property, so flipping `data-theme` reskins the page with no recompile. A name
pointing at a `--cnc-*` token inherits the kit's dark value and so needs no counterpart in the
`[data-theme="dark"]` block; an app-only value is spelled out in both unless it is mode-independent
by construction, which the brand hues (`--accent`, `--pink`, `--gradient-brand`) are. `--surface-2`
and `--muted` resolve to the same grey and stay separate names because components already pick one
or the other.

Those hues are mode-independent because they are fills, and a fill answers to 3:1 while the text
over it answers to 4.5:1. Each one a component also wanted to set text in fails that in one mode or
the other, so `--accent-strong`, `--primary-strong` and `--pink-strong` carry the readable value and
are per-theme wherever the plain hue is not. Which to reach for is in
[`CLAUDE.md`](CLAUDE.md); that they are separate names rather than a darker `--accent` is because
`--primary` also has to keep white legible on `bg-primary`, so one value cannot serve both sides.
