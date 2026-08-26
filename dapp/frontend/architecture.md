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
| `src/backend/` | The `VestingBackend` interface, `LiteBackend` (its one implementation), the pure ACS→domain mappers, the command builders, the `WalletFns` seam, and `config.ts`, which loads the deployment. |
| `src/providers/` | `Backend`: builds the backend from the deployment plus the wallet session, and nothing else. The theme and token-list providers come from the kit, the session provider from `canton-connect`. |
| `src/hooks/` | `useParty` narrows the `canton-connect` session to what the UI needs, `useConnectErrorToast` gives a rejected connection somewhere to surface, and `useRoleLens` / `useCreateGrant` keep the role lens and the create dialog in the URL. |
| `src/store/useVestingStore.ts` | Backend-backed zustand store; actions submit then refresh. |
| `src/utils/` | Pure helpers, `schedule.ts` chief among them, plus `env.ts`, the environment contract `vite.config.ts` validates against, `config.ts`, which reads the literals that validation left behind, and `tokens.tsx`, the one instrument this deployment knows. The two state modules whose view lives elsewhere are here too: `toast.ts` and `topLayer.ts`. |
| `src/components/` | What two or more places render: the shell, the top bar, the dialogs, and the primitives the pages compose. |
| `src/icons/` | One inline icon per file over a shared `Svg` wrapper, re-exported from `index.ts`. |
| `src/pages/` | Dashboard, proposals and grant detail, each a folder whose `index.tsx` is the route and whose siblings are what only that page renders. |
| `src/styles/` | The single stylesheet entry and the app's own tokens. |

## The two seams

**`VestingBackend`** ([`src/backend/VestingBackend.ts`](src/backend/VestingBackend.ts)) is what the
UI depends on. It speaks grants, proposals, and claims — never DAML templates, contract payloads, or
transport. `LiteBackend` satisfies it against the `vesting-lite` DAML package. Because the mappers
that turn active-contract rows into domain types live behind this interface, no component knows the
ledger exists.

**`WalletFns`** ([`src/backend/wallet.ts`](src/backend/wallet.ts)) is the narrower one: the two
session calls `LiteBackend` makes, `execute` and `ledgerApi`, injected as plain functions rather
than implemented by a class. They come straight from `canton-connect`'s `useExecute` and `useLedger`,
which is why they are injected at all: hooks cannot be called from a class, and `LiteBackend`'s unit
tests need it constructible without React.

Both halves of the pairing are runtime state. The deployment comes from
[`config.ts`](src/backend/config.ts), which reads it off the ledger through that same `ledgerApi`:
the newest `vesting-operator-*` among the connected user's rights, then an active-contracts read as
that operator for the factory, which yields `pkg`, the contract id and the `createdEventBlob`.
Nothing is configured, so nothing can go stale against the participant the wallet is pointed at.
Missing is a hard error surfaced by `AppShell`, not a fallback: without a package id there is
nothing to query and without the blob there is no factory to disclose. It needs a session to read
through, so it resolves after connect rather than before.

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
renders.

The session is the other chain, and none of it is this app's. `CantonConnectProvider` owns it,
`ConnectButton` from the kit drives it, and `useParty`
([`src/hooks/useParty.ts`](src/hooks/useParty.ts)) narrows it to the `PartyRef` the UI wants,
standing the party hint in as a display name for the wallets that report none. The shell no longer
gates on it: it always mounts, so the top bar's connect button and the theme toggle stay reachable
and the wallet's own account switch is the only way the acting party changes. A connect that fails
reaches the user through
[`useConnectErrorToast`](src/hooks/useConnectErrorToast.ts), because the kit ships no user-facing
copy and would otherwise fail silently; a cancel is a choice, not a failure, and stays quiet, which
the hook reads off `canton-connect`'s `ConnectCancelledError` rather than off a message.

`useVestingStore` takes the resolved backend from `useBackend` and owns the grant data. Every action
submits through the backend and then refreshes; there is no optimistic local mutation, because a
write is only real once the ledger has it and the read is the only thing that knows. It also drops
every row when the party goes, because the rows were that party's.

A contract id is not a grant's identity, which is the one thing a UI keyed on ids has to know here:
`Contract_Claim` archives the contract and re-creates it with `claimed` raised, so a claim changes
the id of the grant it acted on. `grantLineage` is that identity — everything the choice preserves —
and it is what the withdraw history keys on and what `withdraw` uses to hand the grant-detail page
its successor's id, so a URL survives a claim rather than becoming "Grant not found". `Contract_Cancel`
archives for good, and the page navigates away instead.

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

Only one form has a ceiling, and it is the claim dialog's: the grant's own `claimable`, which is
real ledger state. The create form passes no `balance`, so `validateAmount` applies no `max` there
and the field renders the kit's own no-balance display, `Balance: 0` with `Max` disabled. That is
accurate rather than a placeholder: `vesting-lite` locks an *amount*, moves no holding, and so
takes nothing from the funder that a balance could bound. A real ceiling arrives with Amulet-backed
vesting, and a Canton balance is a set of holding contracts rather than a scalar — CIP-0056 and
CIP-0112 can mix within one party — so what lands then is a party-scoped async read summed exactly,
not a number.

Which kit export to reach for is decided by the surrounding markup. Where an id is a standalone
element it renders the full `<Identifier>` primitive; where it sits inside a `<button>`, a `<Link>`,
or a sentence it uses the pure `truncateIdentifier` / `partyHint` formatters instead, because
`<Identifier>`'s copy control is itself interactive and cannot nest inside another interactive
element.

The explorer those ids link to is the app's to supply: Canton has no canonical one, so the kit
composes URLs only from an `ExplorerConfig`. [`src/utils/config.ts`](src/utils/config.ts) holds that
config as a literal baked in at build time from `VITE_EXPLORER_URL`, not parsed at startup, and the
kit's `useExplorerLink` turns it into hrefs. Counterparty ids go through one component:
[`src/components/CounterpartyId.tsx`](src/components/CounterpartyId.tsx) binds the from/to prefix,
the direction-specific label, and the copy toast, and `GrantCard` and `ProposalCard` render it. The
href stays a per-call-site decision, the way the kit's own `href` is optional: linking an id to an
explorer is a choice each surface makes, not something the app does everywhere. Every `<Identifier>`
the app renders passes `announce={false}`: the `Toaster` is the app's live region, so the kit's own
would double-announce. That one region has to move: `Modal` opens a native `<dialog>` with
`showModal()`, which inerts everything outside the dialog's subtree, so a toast raised over an open
dialog — every failed submit — would be neither clickable nor announced. `utils/topLayer.ts` carries
the open dialog element from `Modal` to the `Toaster`, which portals into it.

That literal is the build's doing. [`vite.config.ts`](vite.config.ts) runs
`parseEnv(loadEnv(...))` and `define`s the parsed values back onto `import.meta.env`, so a bad
`VITE_EXPLORER_URL` fails the build rather than the page load and the client ships no validator at
all. [`src/utils/env.ts`](src/utils/env.ts) holds that contract, and is the only module under `src/`
that runs outside the browser.

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
