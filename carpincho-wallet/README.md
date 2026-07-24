# Carpincho Wallet

Standalone browser wallet for the Canton barebones.

Carpincho is a wallet/provider UI with an encrypted local vault, an injected CIP-0103 browser provider, and optional WalletConnect support. A dApp connects to Carpincho through the injected provider by default; Carpincho answers wallet/provider requests and forwards Canton execution requests to the app's wallet-service JSON-RPC endpoint. A dApp must be explicitly approved per origin before Carpincho exposes accounts or signs for it: an unapproved site sees no accounts, and the first `connect` opens an approval prompt in Carpincho.

```text
dApp frontend -> injected CIP-0103 provider -> carpincho-wallet -> wallet-service /rpc -> Canton participant
```

## Browser extension

### From source

```bash
npm run carpincho:build:extension   # from the repo root
```

The build output is `carpincho-wallet/dist-extension`.

### Load an unpacked extension in Chrome

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the unpacked extension folder.