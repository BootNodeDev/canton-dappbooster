# Canton dAppBooster

![Static Badge](https://img.shields.io/badge/dApp-Booster-green?style=flat&color=%238b46a4) ![GitHub top language](https://img.shields.io/github/languages/top/bootnodedev/canton-dappbooster) ![GitHub branch status](https://img.shields.io/github/checks-status/bootnodedev/canton-dappbooster/main) ![GitHub License](https://img.shields.io/github/license/bootnodedev/canton-dappbooster)

Local Canton development stack.

## Requirements

- Node 24 (>=24.15.0)
- pnpm
- Docker
- dpm (DAML SDK 3.4.11)

## Installation

Run the install script and follow the on-screen instructions.

```bash
pnpm dlx dappbooster --canton
```

A more detailed step-by-step installation guide is available [below](https://github.com/BootNodeDev/canton-dappbooster#installing-and-booting-up-the-dev-stack-manually-step-by-step).

## Starting the dev stack

Once Canton dAppBooster is installed, the easiest way to start the development stack is using the `dev-stack` script. It allows you to install, bring up and tear down everything you need in a simple way.

```bash
./scripts/dev-stack.sh
```

---

## Additional notes

- The demo app runs on http://localhost:3012/ by default.
- Select Wallet Gateway form the picker when connecting and enter `unsafe` as the client secret.
- Wallet Gateway runs on http://localhost:3030 by default. You'll need at least 2 parties in it to explore the demo's features in full. **Create parties with `wallet-kernel` as the signing provider.**
- Technical documentation available at https://docs.dappbooster.cc

---

## Installing and booting up the dev stack manually, step by step

### Clone the repo

```bash
git clone git@github.com:BootNodeDev/canton-dappbooster.git <project-name>
```

### Install

```bash
pnpm i
```

### Run Docker

```bash
open -a Docker
```

### Env vars

```bash
cp .env.example .env
```

Default values should be enough, except for `CANTON_BACKEND_TOKEN` which must be generated.

To generate it run this command and then add the token to `.env`

```bash
pnpm run mint-token
```

### LocalNet

Create a folder for [canton-barebones](https://github.com/BootNodeDev/canton-barebones).

```bash
mkdir -p .canton-localnet
cd .canton-localnet
```

Then run this command to scaffold it.

```bash
pnpm exec canton-barebones init
```

Edit `canton-barebones.config.json`: change `validators.appUser.ui` and `sv.scanUI` to `true`.

Start canton-barebones from `.canton-localnet`

```bash
pnpm exec canton-barebones start
```

**Notes:**

- The first run pulls ~10 GB. If `start` exits 1 during splice migrations, run it again.
- Splice can take a few minutes to start.

### DAR build and deploy

`deploy-dar` requires LocalNet up and running.

```bash
pnpm run build-dar
# use the appropriate version for amulet-vesting-*.dar
pnpm run deploy-dar -- dapp/daml/.daml/dist/amulet-vesting-*.dar
```

**Note:** The step is only needed the first time. Run again if the Daml source changes or if LocalNet is reset.

### Wallet Gateway

Start the [Wallet Gateway](https://github.com/canton-network/wallet), which is the wallet the dApp
connects to.

```bash
pnpm run wallet-gateway
```

### Bootstrap

Needs LocalNet up and running.

```bash
pnpm run bootstrap
```

**Note:** The step is only needed the first time. Run again if the Daml source changes or if LocalNet is reset.

### Demo dApp

Start the Vesting demo app.

```bash
# runs on http://localhost:3012 by default
pnpm run app:dev
```
