# Architecture — Canton Coin vesting dApp

The app's internal seams and the reasoning behind them. What this is and how to run it is in
[`README.md`](README.md); repo-wide rules live in [`../../CLAUDE.md`](../../CLAUDE.md) and the
cross-component picture in [`../../architecture.md`](../../architecture.md).

Everything here follows from one constraint: the wallet is the only way in. It holds the keys, so it
is both the submitter and the reader, and the app never sees a party it is not connected as. Two
interfaces carry that, and every other decision hangs off them.

## Parts

| Path | Role |
|------|------|
| `src/backend/` | The `VestingBackend` interface, `LedgerBackend` (its one implementation), the pure ACS→domain mappers, the command builders, the `WalletFns` seam, `transferContext.ts`, which builds the Amulet context off wallet-service's `amulet.tap`, and `config.ts`, which loads the deployment. |
| `src/providers/` | `Backend`: builds the backend from the deployment plus the wallet session, and nothing else. The theme and token-list providers come from the kit, the session provider from `canton-connect`. |
| `src/hooks/` | `useParty` narrows the `canton-connect` session to what the UI needs, `useConnectErrorToast` gives a rejected connection somewhere to surface, `useDismissable` carries the blur-and-Escape dismissal both hand-rolled dropdowns share, and `useRoleLens` / `useCreateGrant` keep the role lens and the create dialog in the URL. |
| `src/store/useVestingStore.ts` | Backend-backed zustand store; actions submit then refresh. |
| `src/utils/` | Pure helpers, `schedule.ts` chief among them, plus `env.ts`, the environment contract `vite.config.ts` validates against, `config.ts`, which reads the literals that validation left behind, and `tokens.tsx`, the one instrument this deployment knows. The two state modules whose view lives elsewhere are here too: `toast.ts` and `topLayer.ts`. |
| `src/components/` | What two or more places render: the shell, the top bar and its account menu, the footer, the dialogs, and the primitives the pages compose. |
| `src/icons/` | One inline icon per file over a shared `Svg` wrapper, re-exported from `index.ts`. |
| `src/pages/` | Dashboard, pending grants and grant detail, each a folder whose `index.tsx` is the route and whose siblings are what only that page renders. |
| `src/styles/` | The single stylesheet entry and the app's own tokens. |
| `api/` | Vercel functions, published at `/api/<name>` off the deployed origin. `rpc.ts` is the only one, and it forwards a single wallet-service method. Not part of the bundle and not reachable in `pnpm dev`. |

## The two seams

**`VestingBackend`** ([`src/backend/VestingBackend.ts`](src/backend/VestingBackend.ts)) is what the
UI depends on. It speaks grants, pending grants, and claims — never DAML templates, contract payloads,
or transport. `LedgerBackend` satisfies it against the `amulet-vesting` DAML package; it is named
for the thing it reaches rather than for that package, so re-pointing it at another model is not a
rename. Because the mappers that turn active-contract rows into domain types live behind this
interface, no component knows the ledger exists.

**`WalletFns`** ([`src/backend/wallet.ts`](src/backend/wallet.ts)) is the narrower one: the two
session calls `LedgerBackend` makes, `execute` and `ledgerApi`, injected as plain functions rather
than implemented by a class. They come straight from `canton-connect`'s `useExecute` and
`useLedger`, which is why they are injected at all: hooks cannot be called from a class, and
`LedgerBackend`'s unit tests need it constructible without React.

Both halves of the pairing are runtime state. The deployment comes from
[`config.ts`](src/backend/config.ts), which reads it off the ledger through that same `ledgerApi`:
the newest `vesting-operator-*` among the connected user's rights, then an active-contracts read as
that operator for the factory, which yields `pkg`, the contract id and the `createdEventBlob`.
Nothing is configured, so nothing can go stale against the participant the wallet is pointed at.
Missing is a hard error surfaced by `AppShell`, not a fallback: without a package id there is
nothing to query and without the blob there is no factory to disclose. It needs a session to read
through, so it resolves after connect rather than before.

## What a write has to carry

Every choice that moves Amulet takes an `AppTransferContext` — the current `AmuletRules` and the
newest open mining round — and both are DSO-signed, so no connected party is a stakeholder of
either. [`transferContext.ts`](src/backend/transferContext.ts) asks wallet-service for one
`amulet.tap`, whose `disclosedContracts` carry both, and returns the record and the two disclosures
together, because a write needs both and sending one without the other fails at the participant
rather than in the model. The record is flat: nesting the round under a `context` key fails
preprocessing on a missing `openMiningRound`.

That call is a build-and-discard: `amulet.tap` returns the command it composed and submits nothing,
so no coin is minted and the answer is only read for its disclosures. It replaced a pair of reads
against Scan's unauthenticated API, which a browser cannot reach on devnet at all — the SV endpoints
refuse the origin on the preflight and the validator's scan-proxy wants a bearer. Picking the round
went with it: tap resolves the active one itself, and a LocalNet whose SV has not opened the first
round yet fails the call, which is a wait rather than a bug.

Where that call goes is `VITE_WALLET_RPC_URL`. Locally it is wallet-service itself; a deployed build
sets it to `/api/rpc`, [the app's own function](api/rpc.ts), because an https page cannot call a
plain-http wallet-service and Node's fetch has no such policy. The function forwards `amulet.tap`
and nothing else, rebuilding the request rather than relaying it: the dispatcher behind it also
serves `ledgerApi` and `executePrepared` unauthenticated, and republishing those on the product's
own domain is the whole reason this is a function and not a blanket rewrite. `vercel.json`'s
SPA catch-all is scoped away from `/api/` so it cannot answer the route with `index.html`.

The DSO party the split has to name is the one thing tap cannot supply — a disclosure carries an
opaque blob and no payload — so `LedgerBackend` reads it off an Amulet the split is about to
consume. Every Amulet is DSO-signed, so it is the same party by construction.

## Creating a grant takes two approvals

A pending grant records the contract ids of the Amulets its Accept will lock, and that Accept
consumes exactly those. So two grants may never name the same Amulet: accepting one archives it and
leaves the other permanently unacceptable, `CONTRACT_NOT_FOUND` at the `fetch` before the transfer
even runs. Which means each grant needs an Amulet of its own, and `createVesting` makes one — the
funder self-transfers `totalAmount` through `AmuletRules_Transfer`, and the grant names only what
that produced.

That is two submissions and so two wallet prompts, and it cannot be one. Commands in a single Daml
transaction carry fixed arguments, so the second cannot name a contract the first will create;
composing an output into the next input is what a *choice* is for, and adding one is a change to the
DAML rather than to this app.

The split is exact because Splice values an Amulet input at its full `initialAmount` —
`summarizeAndConsumeInput` sums that field, and the holding fee is charged only by `Amulet_Expire`.
An Amulet therefore does not decay out from under a grant while it waits, so no headroom has to be
guessed at, and `amuletValue` is a field read rather than a calculation. `sender`, `provider` and the
one output's `receiver` are all the funder, which is what makes the funder the whole of
`transferControllers` and keeps this a one-signature submission needing nothing from the operator.
`AmuletRules_Transfer` also refuses a submission that does not name the DSO it expects, so
`fetchTransferContext` returns the DSO party and the resolved rules template id alongside the
context.

Whatever an outstanding grant already pledged is kept out of the split's inputs, read off the
funder's own pending-grant rows rather than remembered locally: a transfer consumes everything it is
given, and consuming one of those is exactly the failure this exists to prevent. The Amulet the
split created is then found by re-reading the ACS, because the wallet's own answer to a submission
is an update id and nothing about what it created.

Accept is the one write disclosing something the transfer context cannot supply: the funder's Amulet, which the
receiver is no stakeholder of. Its blob is read with `includeCreatedEventBlob` while the funder is
connected and kept in `localStorage`, written only once the grant is on the ledger — a declined
prompt must not leave a blob behind for an Amulet no grant is waiting on. Appended rather than
replacing, since every outstanding grant's own Amulet has to stay disclosable.

Which of those blobs a given Accept sends is read off the ledger, not guessed: the receiver is an
observer of the grant, so `accept` fetches it and discloses exactly the `amuletCids` it names, then
drops them, since that submission archived them. Sending the whole store instead would re-disclose
Amulets earlier accepts already consumed, grow without bound, and leave the guard unable to tell a
missing blob from an unrelated one — the difference between a sentence naming the problem and an
opaque participant rejection. It is a browser-local hand-off between two wallet accounts, which is
what the demo is; a receiver on another machine has no way to disclose it and `accept` says so
rather than submitting a rejection.

A filter always names a template by package name (`#amulet-vesting:AmuletVesting:…`) and a command
always by the resolved id the deployment carries. The participant rejects each in the other's
position, the filter loudly with `INVALID_FIELD`.

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
what makes `ConnectPrompt`'s copy, and the kit `ConnectButton` inside it, correct wherever it
renders — that face never flips to the disconnect one, which is why the prompt takes it rather than
the kit's `WalletButton`.

The session is the other chain, and none of it is this app's. `CantonConnectProvider` owns it, the
kit's `ConnectButton` and `DisconnectButton` drive it, and `useParty`
([`src/hooks/useParty.ts`](src/hooks/useParty.ts)) narrows it to the `PartyRef` the UI wants,
standing the party hint in as a display name for the wallets that report none, so nothing else in
the app reaches for a `canton-connect` hook. The top bar picks between the two faces itself rather
than reaching for the kit's `WalletButton`, because the connected side is a dropdown of its own:
`TopBar/AccountMenu` holds the copyable party id, the network the session is on, and the disconnect.
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
`AmuletVestingContract_Withdraw` archives the contract and re-creates it with `alreadyWithdrawn`
raised, so a claim changes the id of the grant it acted on. `grantLineage` is that identity —
everything the choice preserves — and it is what the withdraw history keys on and what `withdraw`
uses to hand the grant-detail page its successor's id, so a URL survives a claim rather than
becoming "Grant not found".

A withdraw that drains the escrow is the exception: it creates no successor, because the contract's
`ensure alreadyWithdrawn < totalAmount` is strict and a zero-backing successor would hold a
zero-amount `LockedAmulet`. So the grant is archived, exactly as `AmuletVestingContract_Cancel`
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

Entry is the other half. [`CreateGrant`](src/components/CreateGrant/index.tsx)'s receiver field is
the kit's `<PartyIdInput>`, and the submit gate calls the same `validatePartyId` the field does, so
the two can never disagree about what a party id is. Party ids are exact strings here: nothing
trims, so a stray space is invalid rather than silently stripped on the way to the ledger.

That field is also where the layering is easiest to read. The kit sets `aria-invalid` and hands back
an error *code*; this app owns the sentence, where it sits, and what it looks like. The wording lives
in a `Record<PartyIdError, string>` so a new code added upstream fails the build here instead of
rendering nothing, and the red state is a Tailwind `aria-invalid:` variant rather than
`canton-theme`'s, because the app's utilities sit above the `cnc` layer (see
[`src/styles/index.css`](src/styles/index.css)).

Amounts run that same split twice more. [`CreateGrant`](src/components/CreateGrant/index.tsx)'s
total and [`Claim`](src/components/Claim.tsx)'s withdrawal are both the kit's
`<TokenInput>`: the field sets `aria-invalid` and reports an error *code*, and this app words it
in [`src/utils/amountErrorText.ts`](src/utils/amountErrorText.ts), again an exhaustive `Record` so a
code added upstream fails the build here.

**Neither field offers the token picker, and that is deliberate.** Both pass `token={CC}` and no
`onTokenSelect`, which is what makes the kit render the symbol as a static mark rather than a button.
[`src/utils/tokens.tsx`](src/utils/tokens.tsx) holds `CC` and nothing else, because that is the only
instrument this deployment knows, so a picker over it would open a dialog to choose the value already
chosen. The claim dialog has a second reason it will keep: what a grant pays out is fixed by the
contract, so there is nothing there to pick.

Turning the create field back into a real picker takes three things, none of them wired yet:

- **A list to choose from.** `TOKENS` in `src/utils/tokens.tsx` is a hardcoded one-entry array. It
  becomes whatever enumerates the instruments a deployment actually holds, and the kit's
  `TokenListProvider` is what the picker reads it through.
- **A selection to hold.** The field re-grows its own `useState<TokenMeta>(CC)` and passes
  `onTokenSelect`. Per-field rather than lifted, unless by then two amounts on one page must agree.
- **The rest of the app told about it.** Today the pick would be display-only: the re-lock floor's
  wording, the claim toast, `AmountDisplay`'s coin mark and the grant that gets created all say
  Canton Coin in their own right. Each has to take the chosen token instead, or a pick would relabel
  one field and silently mean nothing.

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

Only the claim dialog has a ceiling, and it is the grant's own `claimable`. The create form has a
balance without one: `VestingBackend.balanceOf` reads what the funder holds and the field offers it
through `Max`, but `validateAmount` is called with no `max`, so a larger amount is neither flagged
nor blocked and the split refuses it instead, naming what is actually free. That is also why the
field's `aria-invalid` is passed in rather than left to the kit, which would flag an amount above
the `balance` it was given.

A Canton balance is a set of holding contracts rather than a scalar, so the read is party-scoped and
summed. It reports what a grant could actually spend rather than what the party owns, over the same
set `splitOff` will draw from: coin already escrowed is a `LockedAmulet` and so out by template, and
coin an outstanding grant pledged is out because spending it would leave that grant unacceptable.
The two agreeing is the point — a `Max` that offered more would put an amount in the field that the
next step always refuses. The read runs once, on mount: nothing the form does moves the funder's
coin.

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
[`src/components/CounterpartyId.tsx`](src/components/CounterpartyId.tsx) binds the from/to prefix,
the direction-specific label, and the copy toast, and `GrantCard` and `PendingGrantCard` render it.
Every `<Identifier>`
the app renders passes `announce={false}`: the `Toaster` is the app's live region, so the kit's own
would double-announce. That one region has to move: `Modal` opens a native `<dialog>` with
`showModal()`, which inerts everything outside the dialog's subtree, so a toast raised over an open
dialog — every failed submit — would be neither clickable nor announced. `utils/topLayer.ts` carries
the open dialog element from `Modal` to the `Toaster`, which portals into it.

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
