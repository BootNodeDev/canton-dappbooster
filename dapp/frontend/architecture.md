# Architecture — Canton Coin vesting dApp

The app's internal seams and the reasoning behind them. What this is and how to run it is in
[`README.md`](README.md); repo-wide rules live in [`../../CLAUDE.md`](../../CLAUDE.md) and the
cross-component picture in [`../../architecture.md`](../../architecture.md).

Everything here follows from one constraint: the app shipped mock-first, and the live ledger path
has to arrive without a UI rewrite. Two interfaces carry that, and every other decision hangs off
them.

## Parts

| Path | Role |
|------|------|
| `src/backend/` | The `VestingBackend` interface, `LiteBackend` (live ledger), and the pure ACS→domain mappers. `createBackend` picks the implementation. |
| `src/mock/` | `MockBackend` (in-memory grants/proposals/claims + command mutations), `MockWallet` (seeded party pool), `seed.ts` (the sample dataset, relative to now), `tokens.ts` (the CC `TokenMeta`), and `balances.ts` (per-party holding contracts behind one delayed `readHoldings`). |
| `src/wallet/` | The `Wallet` interface and `StealthWallet`, its live-ledger implementation. |
| `src/providers/` | `WalletProvider`: resolves the backend and owns the acting party. The theme provider comes from the kit. |
| `src/hooks/` | Two kinds. `useBackend`, `useParty`, `useParties`, and `useConnect` are projections of the wallet context, one per concern. `useToken`, `useTokenPrice`, and `useTokenBalance` are mocked external reads instead, each behind the shape its live counterpart will satisfy — the latter two pair their result with `isLoading` and `error` because a real rate fetch or holdings read can fail. |
| `src/store/useVestingStore.ts` | Backend-backed zustand store; actions submit then refresh. |
| `src/lib/` | Pure helpers, `schedule.ts` chief among them, plus `env.ts`, the environment contract `vite.config.ts` validates against, and `config.ts`, which reads the literals that validation left behind. |
| `src/components/` | The shell, the top bar and sidebar, and the cards, dialogs, table, and charts they compose. |
| `src/features/` | Dashboard, proposals, create, grant detail. |
| `src/styles/` | The single stylesheet entry and the app's own tokens. |

## The two seams

**`VestingBackend`** ([`src/backend/VestingBackend.ts`](src/backend/VestingBackend.ts)) is what the
UI depends on. It speaks grants, proposals, and claims — never DAML templates, contract payloads, or
transport. `MockBackend` satisfies it from memory; `LiteBackend` satisfies it against the
`vesting-lite` DAML package through the wallet-service `ledgerApi` proxy. Because the mappers that
turn active-contract rows into domain types live behind this interface, no component knows the
ledger exists.

**`Wallet`** ([`src/wallet/Wallet.ts`](src/wallet/Wallet.ts)) is the narrower one: list parties, sign
and submit commands. `MockWallet` returns a seeded pool, `StealthWallet` talks to a real
participant.

The pairing is decided once, at startup.
[`createBackend`](src/backend/createBackend.ts) reads `/vesting-lite-parties.json`, a slim
`{pkg, operator, rpcUrl}` file the bootstrap writes into `public/`. Absent or malformed, it returns
an empty config and the app builds `MockWallet` + `MockBackend`. Present, it builds `StealthWallet` +
`LiteBackend`. That file is the entire switch: dropping it in flips the app live with no code change.

## Data flow

```
createBackend ─┐
               ├─▶ WalletProvider ──▶ hooks ──▶ components
Wallet ────────┘        │                          ▲
                        └──▶ useVestingStore ──────┘
```

`WalletProvider` ([`src/providers/WalletProvider.tsx`](src/providers/WalletProvider.tsx)) is the only
place the two seams meet. It loads the config, constructs the pair, fetches the party pool, and holds
which party you are acting as — "connecting" in this app means choosing a party, remembered in
`localStorage` so a reload lands back in the same session.

Its loader is guarded by a monotonic epoch counter, so a slow first load cannot overwrite a faster
later one.

Reads come out through `src/hooks/`, one hook per concern, each a thin projection of the context.
Components never touch the context directly, so the hook signatures are what stays stable when the
mock wallet gives way to a real one.

`useVestingStore` takes the resolved backend from `useBackend` and owns the grant data. Every action
submits through the backend and then refreshes; there is no optimistic local mutation, because the
mock and the ledger must converge on the same observable behaviour.

## Where the numbers come from

`deriveGrant` in [`src/store/useVestingStore.ts`](src/store/useVestingStore.ts) is a pure projection
of a grant at a moment in time — vested, claimable, claimed, status. It and
[`src/lib/schedule.ts`](src/lib/schedule.ts) are the single source of every per-grant figure, and
they mirror the on-ledger math deliberately, so the mock and the live path agree. A component that
derives a grant's own vesting figures is a bug. Two components legitimately compute on top of that
projection rather than beside it: `MilestoneTimeline` splits a total across milestone steps for
display, and `DashboardPage` sums `deriveGrant`'s output into the KPI row. Both take the projection
as their input; neither re-derives it.

Under both sits [`src/lib/amount.ts`](src/lib/amount.ts), the arithmetic floor. Every add,
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

Entry is the other half. [`CreateGrantPage`](src/features/CreateGrantPage.tsx)'s receiver field is
the kit's `<PartyIdInput>`, and the submit gate calls the same `validatePartyId` the field does, so
the two can never disagree about what a party id is. Party ids are exact strings here: nothing
trims, so a stray space is invalid rather than silently stripped on the way to the ledger. The seed
fingerprints in [`src/mock/seed.ts`](src/mock/seed.ts) are the full 68 characters a real one has,
because anything shorter now fails that check.

That field is also where the layering is easiest to read. The kit sets `aria-invalid` and hands back
an error *code*; this app owns the sentence, where it sits, and what it looks like. The wording lives
in a `Record<PartyIdError, string>` so a new code added upstream fails the build here instead of
rendering nothing, and the red state is a Tailwind `aria-invalid:` variant rather than
`canton-theme`'s, because the app's utilities sit above the `cnc` layer (see
[`src/styles/index.css`](src/styles/index.css)).

Amounts run that same split twice more. [`CreateGrantPage`](src/features/CreateGrantPage.tsx)'s
total and [`ClaimDialog`](src/components/ClaimDialog.tsx)'s withdrawal are both the kit's
`<TokenInput>`: the field sets `aria-invalid` and reports an error *code*, and this app words it
in [`src/lib/amountErrorText.ts`](src/lib/amountErrorText.ts), again an exhaustive `Record` so a
code added upstream fails the build here.

Both fields also open the kit's token picker, and on both the pick is deliberately display-only: it
relabels the field and nothing else. Everything around it is still Canton Coin — the balance and the
`max` behind it, the USD rate, the re-lock floor's wording, the claim toast, and the grant that gets
created. `useTokenBalance` reads no holdings for a symbol other than `CC`, so choosing another token
empties the balance and Max rather than showing a wrong one; the rest of the CC wording stays put
and will read as a mismatch until per-token balances land. The picker is wired ahead of them on
purpose, so the mock exercises the list.

Both pages re-derive that code with the kit's own `validateAmount` rather than storing the one
`onChange` handed them, because the bounds move on their own: the claim dialog's ceiling is a
live-vesting `claimable` that recomputes each second, and a stored code would keep flagging an
amount the field had already accepted. The field is still the single source of the rule; the app
just asks it again at render time.

The division of labour underneath is the part neither side announces. The kit owns one amount at
one precision: parse, format, sanitize a keystroke, validate against the ledger's own limits and a
`max`. It knows nothing
about a second amount, so everything that combines two of them is this app's, in
[`src/lib/amount.ts`](src/lib/amount.ts), built on the kit's `parseAmount` / `formatScaled` pair and
on nothing else of the kit's. So the field's `balance` is the ceiling, while both floors are the
app's: the create form's `MIN_GRANT_AMOUNT`, and the claim dialog's re-lock floor, which is a rule
about the *remainder* and so about two amounts at once.

Each form's ceiling comes from a different place. The claim dialog's is the grant's own `claimable`;
the create form's is what the funder holds, read by
[`useTokenBalance`](src/hooks/useTokenBalance.ts) — party-scoped, async, and summed exactly across
holding contracts, since a balance on Canton is a set of them rather than a scalar and the standards
(CIP-0056, CIP-0112) can mix within one party. While that read is in flight or has failed, no
`balance` is passed and the field says so through `balanceState`: a gap in the read must not arrive
as a ceiling of zero.

Which kit export to reach for is decided by the surrounding markup. Where an id is a standalone
element it renders the full `<Identifier>` primitive; where it sits inside a `<button>`, a `<Link>`,
or a sentence it uses the pure `truncateIdentifier` / `partyHint` formatters instead, because
`<Identifier>`'s copy control is itself interactive and cannot nest inside another interactive
element.

The explorer those ids link to is the app's to supply: Canton has no canonical one, so the kit
composes URLs only from an `ExplorerConfig`. [`src/lib/config.ts`](src/lib/config.ts) holds that
config as a literal baked in at build time from `VITE_EXPLORER_URL`, not parsed at startup, and the
kit's `useExplorerLink` turns it into hrefs. Counterparty ids go through one component:
[`src/components/CounterpartyId.tsx`](src/components/CounterpartyId.tsx) binds the from/to prefix,
the direction-specific label, and the copy toast, and `GrantCard` and `ProposalCard` render it. The
href stays a per-call-site decision, the way the kit's own `href` is optional: linking an id to an
explorer is a choice each surface makes, not something the app does everywhere. Every `<Identifier>`
the app renders passes `announce={false}`: the `Toaster` is the app's live region, so the kit's own
would double-announce.

That literal is the build's doing. [`vite.config.ts`](vite.config.ts) runs
`parseEnv(loadEnv(...))` and `define`s the parsed values back onto `import.meta.env`, so a bad
`VITE_EXPLORER_URL` fails the build rather than the page load and the client ships no validator at
all. [`src/lib/env.ts`](src/lib/env.ts) holds that contract, and is the only module under `src/`
that runs outside the browser.

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
