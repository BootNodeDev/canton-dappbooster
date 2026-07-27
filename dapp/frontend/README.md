# @canton-dappbooster/frontend — Canton Coin vesting dApp

Direct-access dApp for **Canton Coin vesting**: propose a grant, the beneficiary
accepts, claim as it vests, or cancel into a residual claim. Grants render live
vested/claimable figures from the pure schedule math in [`src/lib/schedule.ts`](src/lib/schedule.ts).

It runs **mock-first**: with no deployment config present it uses an in-memory
`MockBackend` seeded with sample parties, grants, proposals, and a residual claim,
so the whole app is explorable with **no wallet-service, Canton, or DAR**. See the
root [README](../../README.md) for the wider stack.

> Imported from `cn-dappbooster@feat/vesting-lite` — see [`PROVENANCE.md`](PROVENANCE.md).
> The live `LiteBackend` path (real ledger via the wallet-service proxy), its
> `vesting-lite` DAML package, and the party-bootstrap script are **deferred**; only
> the frontend + mock layer are in this repo today.

## Run

From the repo root (one `pnpm install` links every workspace):

```bash
pnpm run app:dev   # → http://localhost:3012
```

Pick any party on the landing screen to "connect" (the DirectWallet just chooses
which party you act as; it is remembered in `localStorage`). No env vars needed.

## Parts

| Path | Role |
|------|------|
| `src/backend/` | `VestingBackend` interface + pure ACS→domain mappers. `createBackend` returns the in-memory `MockBackend` by default, or `LiteBackend` (real ledger over the wallet-service `ledgerApi` proxy) once a `vesting-lite-parties.json` is present. |
| `src/mock/` | `MockBackend` (in-memory grants/proposals/claims + command mutations), `MockWallet` (seeded party pool), and `seed.ts` (the sample dataset, relative to now). |
| `src/wallet/` | `DirectWalletProvider`: the party pool and the "acting as" party. Exposes `useParty` / `useConnect` / `useParties` / `useBackend`. |
| `src/store/useVestingStore.ts` | Backend-backed store; actions submit then refresh. Pure `deriveGrant` + `lib/schedule.ts` mirror the on-ledger math. |
| `src/app/` | Shell: landing party-picker, top bar (role lens, theme, party switcher), sidebar. Renders the app only once a party is selected. |
| `src/features/` | Pages: dashboard, proposals, create, grant-detail. |

## Going live (deferred)

When the `vesting-lite` DAML package and bootstrap land, dropping the
bootstrap-written `public/vesting-lite-parties.json` (`{pkg, operator, rpcUrl}`)
flips `createBackend` to `LiteBackend` with no code change — the `MockBackend` and
`LiteBackend` share the same `VestingBackend` seam.

## Note: kit Placeholder

The top bar renders `<Placeholder />` from `@bootnodedev/canton-dappbooster`
(styled by `@bootnodedev/canton-theme`) once connected — a temporary proof that the
kit build + theming pipeline is wired end-to-end. It is replaced by the real
`<Identifier>` primitive in #6.
