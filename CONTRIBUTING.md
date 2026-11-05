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
pnpm dev:token-vesting up     # LocalNet, its DARs, token registry, Wallet Gateway and dApp
pnpm dev:token-vesting down   # stop everything and keep the ledger
```

The dApp runs on http://localhost:3012, its token registry on http://localhost:3013 and Wallet
Gateway on http://localhost:3030. The examples share the LocalNet, so stop one before you start
another.

`pnpm dev:amulet-vesting` and `pnpm dev:token-vesting` run the installer's local network scripts
against the example's own folder, which is why `example-dapps/amulet-vesting` has no `build-dar` or
`deploy-dar` script of its own. A project the installer makes gets the published example instead,
fetched with `npm pack`.

### Installer

```bash
pnpm -C canton-create try         # pack the installer and every example into canton-create/.try
pnpm -C canton-create try:clean   # stop the stack, reset the LocalNet and remove .try
```

`try` then prints the commands that run them there, as a user would.

## Where to read next

- [`architecture.md`](architecture.md) maps the stack: data flow, services and ports, auth, orchestration and packaging;
- each package's `README.md` says what it is and how to use it, and its `architecture.md` how it works: [`canton-connect`](canton-connect/architecture.md), [`canton-dappbooster`](canton-dappbooster/architecture.md), [`canton-create`](canton-create/architecture.md), [`amulet-vesting`](example-dapps/amulet-vesting/architecture.md) and [`token-vesting`](example-dapps/token-vesting/architecture.md). `canton-theme` has none: the split between components and theme is in canton-dappbooster's;
- the `CLAUDE.md` files hold the rules for writing code here. They are addressed to agents and bind humans too: [`CLAUDE.md`](CLAUDE.md) for the repo, and one in each package for its deltas.

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