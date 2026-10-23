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