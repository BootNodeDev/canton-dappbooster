# Contributing to Canton dAppBooster

## Requirements

- Node >=24.15.0
- pnpm
- Docker
- dpm (Daml SDK 3.5.2)

## Setup

```bash
git clone git@github.com:BootNodeDev/canton-dappbooster.git
cd canton-dappbooster
nvm use
corepack enable
pnpm install
```

## Local development

### Amulet Vesting dApp

Interactive menu:

```bash
pnpm dev:amulet-vesting
```

Command line:

```bash
pnpm dev:amulet-vesting up     # LocalNet, contract, Wallet Gateway and dApp
pnpm dev:amulet-vesting down   # stop everything and keep the ledger
```

The dApp runs on http://localhost:3012 and Wallet Gateway on http://localhost:3030.

Connect through Wallet Gateway with `unsafe` as the client secret. Use `wallet-kernel` as the
signing provider when creating parties.

To rebuild and redeploy the contract alone:

```bash
pnpm run build-dar
pnpm run deploy-dar -- example-dapps/amulet-vesting/daml/.daml/dist/amulet-vesting-<version>.dar
```

`<version>` is the one in `example-dapps/amulet-vesting/daml/daml.yaml`, and `deploy-dar` sends the
token in `example-dapps/amulet-vesting/.env`.

### Token Vesting dApp

```bash
pnpm dev:token-vesting        # interactive menu
pnpm dev:token-vesting up     # LocalNet, both DARs, token registry, Wallet Gateway and dApp
pnpm dev:token-vesting down   # stop everything and keep the ledger
```

The dApp runs on http://localhost:3012, its token registry on http://localhost:3013 and Wallet
Gateway on http://localhost:3030. Both examples share the LocalNet, so stop one before you start the
other.

## Before opening a pull request

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm knip
pnpm docs:check
pnpm run check:anatomy
pnpm run check:versions
```