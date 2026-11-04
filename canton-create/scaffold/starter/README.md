# Canton dApp

A React and Vite app on the Canton dAppBooster libraries:

- `@bootnodedev/canton-connect` for the wallet session and its hooks;
- `@bootnodedev/canton-dappbooster` for the headless components;
- `@bootnodedev/canton-theme` for the default style sheet, which `src/index.css` imports once.

The [documentation](https://docs.dappbooster.cc/) covers the stack and the local network, and the [components documentation](https://components.dappbooster.cc/) is the reference for the libraries' hooks and components.

## Run the app

The dev server serves on http://localhost:3012.

With npm:

```bash
npm install   # only if the installer skipped it
npm run dev
```

With pnpm:

```bash
pnpm install   # only if the installer skipped it
pnpm dev
```

`.env` sets `VITE_MOCK_WALLET=true`, so the wallet picker offers a mock wallet, and you can connect before a real one is reachable.

## Connect a real wallet

Set `VITE_WALLET_GATEWAY_URL` in `.env` to a [Wallet Gateway](https://github.com/canton-network/wallet) and it appears in the picker. The picker also lists any CIP-0103 browser wallet it finds in the page. Unset `VITE_MOCK_WALLET` when you no longer need the mock.
