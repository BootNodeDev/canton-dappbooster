# Canton dAppBooster

![Static Badge](https://img.shields.io/badge/dApp-Booster-green?style=flat&color=%238b46a4) ![GitHub top language](https://img.shields.io/github/languages/top/bootnodedev/canton-dappbooster) ![GitHub branch status](https://img.shields.io/github/checks-status/bootnodedev/canton-dappbooster/main) ![GitHub License](https://img.shields.io/github/license/bootnodedev/canton-dappbooster)

Local Canton development stack.

## Requirements

- Node 24 (>=24.15.0)
- pnpm
- Docker

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
- A compatible CIP-0103 wallet (like the [Carpincho development wallet](https://github.com/BootNodeDev/carpincho-wallet)) is required to connect to the demo app. Point the wallet at http://localhost:3010/rpc when asked. You'll need at least 2 accounts in the wallet to explore the demo's features in full.
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

### DAR deploy

`deploy-dar` requires LocalNet up and running.

```bash
pnpm run deploy-dar -- vendor/canton-token-forge.dar
pnpm run deploy-dar -- vendor/vesting.dar
```

**Note:** Safe to re-run. It reuses the operator, factory and instrument it finds on the ledger and
creates only what is missing, so the holdings and grants of an earlier run survive a `down` and `up`.
A LocalNet reset drops the parties with the ledger, so the next run creates them again. Both DARs are
committed binaries and need no build, so no DAML SDK is involved; `canton-token-forge` goes
first, because `vesting` data-depends on it. See `vendor/PROVENANCE.md`.

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

**Note:** Safe to re-run. It reuses the operator, factory and instrument it finds on the ledger and
creates only what is missing, so the holdings and grants of an earlier run survive a `down` and `up`.
A LocalNet reset drops the parties with the ledger, so the next run creates them again. A ledger
bootstrapped before this step became idempotent carries `vesting-operator-<stamp>` parties that no
run adopts; reset it once and the holdings from those runs are gone with it.

### Token registry

Needs the registry env block `bootstrap` printed above, plus `CANTON_BACKEND_TOKEN` from `.env` as the bearer.

```bash
source .env
# paste the block bootstrap printed, skipping its LEDGER_API_TOKEN placeholder line, then:
export LEDGER_API_URL ADMIN_PARTY INSTRUMENT_CONFIG_TEMPLATE_ID PREAPPROVAL_TEMPLATE_ID \
  LOCKED_TOKEN_TEMPLATE_ID TRANSFER_INSTRUCTION_TEMPLATE_ID ALLOCATION_TEMPLATE_ID PORT
DOTENV_CONFIG_PATH=/dev/null LEDGER_API_TOKEN="$CANTON_BACKEND_TOKEN" pnpm exec canton-token-forge-registry
```

`DOTENV_CONFIG_PATH=/dev/null` is not optional: the registry loads dotenv from the directory it
starts in, which here is the repo root, so without it the whole of `.env` is read into the registry
process, `CANTON_AUTH_SECRET` included.

**Note:** `./scripts/dev-stack.sh up` automates this step, reading the block back out of its own bootstrap log.

### Demo dApp

Start the Vesting demo app.

```bash
# runs on http://localhost:3012 by default
pnpm run app:dev
```
