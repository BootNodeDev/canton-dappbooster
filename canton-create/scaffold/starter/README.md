# Canton dApp

A React and Vite app on the Canton dApp kit:

- `@bootnodedev/canton-connect` for the wallet session and its hooks
- `@bootnodedev/canton-dappbooster` for the headless components
- `@bootnodedev/canton-theme` for the default style sheet, which `src/index.css` imports once

## Run the app

If the installer skipped the install, run `pnpm install` first. Then start the dev server:

```bash
pnpm dev
```

With npm, the command is `npm run dev`. The app serves on http://localhost:3012.

`.env` sets `VITE_MOCK_WALLET=true`, so the wallet picker offers a mock wallet, and you can connect
before a real one is reachable.

## Connect a real wallet

Set `VITE_WALLET_GATEWAY_URL` to a [Wallet Gateway](https://github.com/canton-network/wallet) and it
appears in the picker. The picker also lists any CIP-0103 browser wallet it finds in the page. Unset
`VITE_MOCK_WALLET` when you no longer need the mock.

## Learn more

- The [documentation](https://docs.dappbooster.cc/) covers the stack and the local network.
- The [components documentation](https://components.dappbooster.cc/) is the reference for the kit's
  hooks and components.
