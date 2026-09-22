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

A more detailed [step-by-step installation guide](https://docs.dappbooster.cc/installation/step-by-step) is available in the [documentation](https://docs.dappbooster.cc/).

## Starting the dev stack

Once Canton dAppBooster is installed, the easiest way to start the development stack is using the `dev-stack` script. It allows you to install, bring up and tear down everything you need in a simple way.

```bash
./scripts/dev-stack.sh
```

---

## Additional notes

- The demo app runs on http://localhost:3012/ by default.
- Select Wallet Gateway from the picker when connecting and enter `unsafe` as the client secret.
- Wallet Gateway runs on http://localhost:3030 by default. You'll need at least 2 parties in it to explore the demo's features in full. **Create parties with `wallet-kernel` as the signing provider.**
