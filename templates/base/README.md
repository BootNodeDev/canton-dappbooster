# Canton dApp

A React + Vite app wired to the Canton dApp kit:

- `@bootnodedev/canton-connect` — wallet session and hooks
- `@bootnodedev/canton-dappbooster` — headless components
- `@bootnodedev/canton-theme` — the default stylesheet, imported once in `src/index.css`

## Run

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The app serves on http://localhost:3012. With `VITE_MOCK_WALLET=true` the wallet picker offers a
mock wallet, so you can connect before a real one is reachable.

## Connect a real wallet

Set `VITE_WALLET_GATEWAY_URL` to a [Wallet Gateway](https://github.com/canton-network/wallet) and
it appears in the picker, which also lists any CIP-0103 browser wallet it finds in the page. Unset
`VITE_MOCK_WALLET` once the mock is no longer needed.

## Next

- Hooks: `useAccount`, `useLedger`, `useExecute`, `useSignMessage` from `@bootnodedev/canton-connect`
- Components: `Identifier`, `PartyIdInput`, `TokenInput`, `ExplorerLink` from `@bootnodedev/canton-dappbooster`
- Source and docs: https://github.com/BootNodeDev/canton-dappbooster
