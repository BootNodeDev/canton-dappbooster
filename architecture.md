# Architecture Overview — Canton dAppBooster

## Tech Stack

| Subproject | Stack | Purpose |
| --- | --- | --- |
| LocalNet (external: [BootNodeDev/canton-barebones](https://github.com/BootNodeDev/canton-barebones)) | Node CLI over Docker Compose + the official Splice LocalNet bundle | Starts `sv + app-user`. A pinned devDependency, scaffolded by `dev-stack.sh` into the gitignored `.canton-localnet/` |
| `scripts/` | Bash + Node | The local loop: `dev-stack.sh`, the DAR build and upload, the token mint, the vesting bootstrap |
| wallet-service (external: [BootNodeDev/canton-wallet-service](https://github.com/BootNodeDev/canton-wallet-service)) | Node 24 + Express 5 + TypeScript + `@canton-network/wallet-sdk` | Bridge the wallet uses for external-party onboarding and participant JSON API calls. A git dependency pinned to a tag, run on the host by `scripts/dev-stack.sh` |
| `dapp/frontend/` | Vite + React + Tailwind v4 + zustand + react-router | Canton Coin **vesting** dApp; every read and write goes through the connected CIP-0103 wallet via `canton-connect` |
| `dapp/daml/vesting-lite/` | DAML | `vesting-lite` DAR: the vesting factory, proposal, contract and residual-claim templates |
| `canton-connect/` | TypeScript + React 19 | wagmi-style hooks wrapping the dapp-sdk facade |
| `canton-dappbooster/` | TypeScript + React 19 + tsdown | L2 headless UI components, zero styling, plus the theme runtime and the pure utilities under the components, exact-decimal amounts included |
| `canton-theme/` | CSS | L3 plain-CSS theme: `--cnc-*` tokens + prestyled defaults |

## Data Flow

```mermaid
flowchart TD
  fe["dapp/frontend<br/>http://localhost:3012"]
  wallet["CIP-0103 browser wallet (separate repo)<br/>http://localhost:3011"]
  ws["wallet-service (separate repo)<br/>http://localhost:3010"]
  au["Splice app-user<br/>JSON API http://localhost:2975"]
  sv["Splice sv<br/>DSO / synchronizer side"]
  scan["Scan<br/>http://scan.localhost:4000"]
  dar["vesting-lite DAR"]

  fe <-->|"CIP-0103 provider: reads, writes, session"| wallet
  wallet -->|"onboarding, prepare/execute, JSON API"| ws
  ws -->|"CANTON_BACKEND_TOKEN"| au
  au <--> sv
  dar --> au
```

> `dapp/frontend` hosts the Canton Coin vesting dApp. It never talks to wallet-service itself:
> every ledger read and every submission goes through the wallet over CIP-0103, so the dApp
> only ever acts as the connected account and each write is signed by the account's own key.

`app-user` is the primary local validator from the official Splice LocalNet
bundle. It is not a product user. `sv` provides the Super Validator / DSO side
needed by Splice and Canton Coin. The app-provider UI profile is not started;
its Nginx routes are disabled locally. The official shared Canton/Splice
containers still expose app-provider backend ports.

State boundaries:

- The CIP-0103 path: a dApp talks to the wallet through the provider surface, which is how the vesting dApp in `dapp/frontend` gets its session, its ledger reads, and its submissions.
- The wallet owns user keys and signs locally.
- wallet-service holds `CANTON_BACKEND_TOKEN` and remains the external-party onboarding bridge.
- Splice LocalNet owns the app-user participant/validator, Scan, SV, and CC infrastructure.
- wallet-service is not a container at all: it runs on the host, so it reaches Canton and Splice
  over `localhost` rather than `host.docker.internal`.
- The wallet should use generated bearer tokens for direct LocalNet endpoints; it should not copy `CANTON_AUTH_SECRET` into the browser.

## Services And Ports

| Service | URL / Port | Purpose |
| --- | --- | --- |
| wallet-service | `http://localhost:3010` | wallet bridge for onboarding and JSON API calls |
| CIP-0103 browser wallet | `http://localhost:3011` | browser wallet UI/provider, run from its own repo |
| dApp frontend | `http://localhost:3012` | example dApp |
| app-user Wallet UI | `http://wallet.localhost:2000` | optional official Splice wallet UI |
| app-user Ledger API | `grpc://localhost:2901` | SDK/tools |
| app-user Admin API | `grpc://localhost:2902` | wallet-service/tools |
| app-user Validator API | `http://localhost:2903` | health/tools |
| app-user JSON API | `http://localhost:2975` | wallet-service/tools |
| app-user Validator proxy | `http://localhost:2000/api/validator` | wallet/tools |
| app-provider backend APIs | `grpc://localhost:3901`, `grpc://localhost:3902`, `http://localhost:3903`, `http://localhost:3975` | official bundle wiring, unused |
| app-provider UI port | `http://localhost:3000` | exposed by Nginx, routes disabled |
| Scan UI | `http://scan.localhost:4000` | explorer/read model UI |
| Scan API | `http://scan.localhost:4000/api/scan` | wallet/tools |
| Amulet Registry | `http://localhost:2000/api/validator/v0/scan-proxy` | token metadata |
| SV UI | `http://sv.localhost:4000` | Super Validator operations UI |
| sv Ledger/Admin/JSON APIs | `grpc://localhost:4901`, `grpc://localhost:4902`, `http://localhost:4975` | Splice internals/tools |
| sv Validator API | `http://localhost:4903` | health checks |
| PostgreSQL | `localhost:5432` | Splice LocalNet database |

## Auth

| Variable | Owner | Purpose |
| --- | --- | --- |
| `CANTON_AUTH_AUDIENCE` | `.env` | JWT audience recipe used by `scripts/mint-token.mjs` |
| `CANTON_AUTH_SECRET` | `.env` | unsafe local signing secret used only by the token script |
| `CANTON_BACKEND_TOKEN` | `.env` | generated JWT consumed by wallet-service and the DAR upload |

The root `.env` is the only one that matters: wallet-service's whole configuration, since it
loads dotenv from the directory it starts in, plus the signing recipe `scripts/mint-token.mjs`
reads and the token `scripts/deploy-dar.sh` sends. Minting is offline, so it needs nothing
running, which is what lets `dev-stack.sh up` mint `CANTON_BACKEND_TOKEN` into a fresh `.env`
before anything is up. The LocalNet is configured by its own `canton-barebones.config.json`,
scaffolded into `.canton-localnet/` and tracked by nothing.

`CANTON_AUTH_AUDIENCE` plus `CANTON_AUTH_SECRET` is the local signing recipe.
`CANTON_BACKEND_TOKEN` is the generated token. The token script defaults the
JWT subject to `ledger-api-user`; the wallet can use a separate token generated
with the same script, configured manually in its LocalNet settings.

## Orchestration

| Command | What it does |
| --- | --- |
| `./scripts/dev-stack.sh up` | the whole local loop: LocalNet, DAR, wallet-service on 3010, bootstrap, dApp dev server |
| `./scripts/dev-stack.sh down` | stop wallet-service and the dApp dev server, stop the LocalNet |
| `pnpm exec canton-barebones start` / `stop` / `reset` / `status` | the LocalNet itself, run from `.canton-localnet/` |
| `node scripts/localnet-config.mjs <dir>` | scaffold that directory and apply the flags nginx needs |
| `pnpm run mint-token` | generate a LocalNet dev JWT, offline |
| `pnpm run build-dar` | compile the DAR with `dpm` |
| `pnpm run deploy-dar -- <dar>` | upload DAR to app-user JSON API |
| `pnpm run bootstrap` | create the vesting operator and its factory |
| `pnpm run app:dev` | start the dApp frontend |

`dev-stack.sh` shells out to the LocalNet tool in the directory passed as its second argument
(`./scripts/dev-stack.sh up <dir>`), else `CANTON_LOCALNET_DIR`, else `.canton-localnet/`. It
scaffolds that directory on `up` from the pinned tool's own template, re-scaffolding when the
template moves past the local copy, so the config drifts from the installed version rather than
from a committed file. The Splice checkout and the runtime env land in its `.generated/`.

For the bring-up sequence, follow [`README.md`](README.md).
