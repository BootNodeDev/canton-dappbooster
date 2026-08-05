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
| `src/mock/` | `MockBackend` (in-memory grants/proposals/claims + command mutations), `MockWallet` (seeded party pool), and `seed.ts` (the sample dataset, relative to now). |
| `src/wallet/` | The `Wallet` interface and `StealthWallet`, its live-ledger implementation. |
| `src/providers/` | `WalletProvider`: resolves the backend and owns the acting party. The theme provider comes from the kit. |
| `src/hooks/` | Projections of the wallet context, one per concern. |
| `src/store/useVestingStore.ts` | Backend-backed zustand store; actions submit then refresh. |
| `src/lib/` | Pure helpers, `schedule.ts` chief among them, plus `env.ts`, the zod schema `vite.config.ts` validates the environment against, and `config.ts`, which reads the literals that validation left behind. |
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
[`src/lib/schedule.ts`](src/lib/schedule.ts) are the single source of every figure the UI shows, and
they mirror the on-ledger math deliberately, so the mock and the live path agree. A component that
computes a vesting figure itself is a bug.

## The kit seam

Party ids come from `@bootnodedev/canton-dappbooster`, styled by `@bootnodedev/canton-theme`. The app
holds no truncation or copy-to-clipboard logic of its own.

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
the direction-specific label, the copy toast, and the explorer href in one place, and `GrantCard`
and `ProposalCard` render it. Every `<Identifier>` the app renders passes `announce={false}`: the
`Toaster` is the app's live region, so the kit's own would double-announce.

That literal is the build's doing. [`vite.config.ts`](vite.config.ts) runs
`parseEnv(loadEnv(...))` and `define`s the parsed values back onto `import.meta.env`, so a bad
`VITE_EXPLORER_URL` fails the build rather than the page load and the client ships neither zod nor
the check. [`src/lib/env.ts`](src/lib/env.ts) is that schema, and the only module under `src/` that
runs outside the browser.

Theme is the kit's too. `ThemeProvider` in `App.tsx` applies `data-theme` to `<html>` on the kit's
default storage key, and [`src/styles/tokens.css`](src/styles/tokens.css) keys the app's own
`--fg` / `--bg` set off the same attribute. The reload flash that comes with that, and why no
pre-paint script sits in `index.html`, are the kit's call:
[`canton-dappbooster/architecture.md`](../../canton-dappbooster/architecture.md).

## Stylesheet layering

[`src/styles/index.css`](src/styles/index.css) is the single entry. Its leading
`@layer properties, theme, base, cnc, components, utilities` is declared before the first `@import`,
which is what puts the kit theme's `cnc` layer above Tailwind's preflight and below the app's
utilities. Moving that line below an import silently reorders the cascade.
