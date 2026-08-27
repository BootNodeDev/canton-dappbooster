# Canton dAppBooster

Local Canton development stack.

## Requirements

- Node 24 (>=24.15.0)
- pnpm 11.22.0
- Docker
- dpm (DAML SDK 3.4.11)

## Initial setup

```bash
pnpm install
```

### Env vars

```bash
cp .env.example .env
```

Default values should be enough, except for `CANTON_BACKEND_TOKEN` which must be generated.

### CANTON_BACKEND_TOKEN generation

```bash
pnpm run mint-token
```

### LocalNet

First create a folder to run [canton-barebones](https://github.com/BootNodeDev/canton-barebones) and scaffold it.

```bash
mkdir -p ~/canton-localnet && cd ~/canton-localnet
npx @bootnodedev/canton-barebones init
```

Edit `canton-barebones.config.json`: change `validators.appUser.ui` and `sv.scanUI` to `true`.

## Starting the stack

The easiest way is using the `dev-stack` script.

```bash
./scripts/dev-stack.sh
```

**Note:** If you scaffolded canton-barebones in a folder other than `~/canton-localnet` you can run.

```bash
./scripts/dev-stack.sh ~/path-to-your-folder
```

## Starting the stack, step by step

### Docker

```bash
open -a Docker
```

### LocalNet

Start canton-barebones.

```bash
cd ~/canton-localnet
npx @bootnodedev/canton-barebones start
```

**Notes:**

- The first run pulls ~10 GB. If `start` exits 1 during splice migrations, run it again.
- Splice can take a few minutes to start.

### DAR build and deploy

`deploy-dar` requires LocalNet up and running.

```bash
pnpm run build-dar
pnpm run deploy-dar -- dapp/daml/vesting-lite/.daml/dist/vesting-lite-0.0.1.dar
```

**Note:** The step is only needed the first time. Run again if the Daml source changes or if LocalNet is reset with `npx @bootnodedev/canton-barebones reset`.

### Wallet service

Start [wallet-service](https://github.com/BootNodeDev/canton-wallet-service).

```bash
pnpm exec canton-wallet-service
```

### Bootstrap

Needs both LocalNet and wallet-service up and running.

```bash
pnpm run bootstrap
```

**Note:** The step is only needed the first time. Run again if the Daml source changes or if LocalNet is reset.

### Demo dApp

Start the Vesting demo app.

```bash
pnpm run app:dev
```

App runs on http://localhost:3012 by default.

A compatible CIP-0103 wallet (like the [Carpincho development wallet](https://github.com/BootNodeDev/carpincho-wallet)) is required to connect to the demo.

Point the wallet at http://localhost:3010/rpc, create at least 2 accounts, connect and try [the demo](https://demo.dappbooster.cc/).
