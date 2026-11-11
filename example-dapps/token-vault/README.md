# Token vault dApp

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

`@bootnodedev/canton-example-token-vault` is a token vault dApp. You deposit `USDX`, a [canton-token-forge](https://github.com/BootNodeDev/canton-token-forge) token, and get `VSH` vault shares one for one. You return shares and get `USDX` back. Every read and write goes through your CIP-0103 wallet, as your own party.

> [!NOTE]
> This app builds no contract. Its two Daml packages, the vault and the canton-token-forge token, are prebuilt DARs in `vendor/`, so it needs no Daml toolchain. [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vault/architecture.md#the-committed-dars) records each one.

## Run the app

You need Node 24.15 or later, pnpm, and Docker running.

1. Create a project from this example, with the local network.

   ```bash
   pnpm create canton-dappbooster --example token-vault --localnet
   ```

2. In the project folder, start everything (LocalNet, DARs, vault operator, Wallet Gateway and dApp).

   ```bash
   pnpm stack up
   ```

3. Open http://localhost:3012, pick Wallet Gateway in the wallet picker and log in with the client secret `unsafe`. Create a party in the gateway.
4. In the account menu, use **Tap US Dollar X** to get 1000 `USDX`.
5. Deposit: enter an amount under **Deposit** and approve it in the gateway. Within a few seconds the request asks for your funds. Press **Fund**, approve again, and `VSH` arrives once the vault settles.
6. Withdraw: the same steps under **Withdraw**, paying in `VSH`. The vault funds its own `USDX` side, settles, and burns the shares.

## How it works

A deposit or a withdraw takes two parties, you and the vault, and neither can finish it alone:

- you propose an amount, which creates a `DepositProposal` or a `WithdrawProposal`;
- the vault operator accepts it, which turns it into a request with a settlement deadline;
- you fund the request: your wallet escrows your `USDX`, or your `VSH`, against it;
- for a withdraw, the operator escrows the vault's own `USDX` for your side;
- the operator settles: a deposit mints `VSH` to you, a withdraw sends `USDX` to you and burns the `VSH`.

The vault operator is `scripts/vault-operator.mjs`, a small process that acts as the vault party. It reads the ledger every three seconds. The page reads it every five, so a request changes state on its own while you watch.

Until the operator accepts a proposal, you can cancel it from its row. The operator usually accepts within seconds, so a cancel often arrives too late, and the wallet then reports the proposal as gone.

The dApp keeps no configuration about the vault. Each time a party connects, it finds the vault, both tokens and their contract ids on the ledger.

## Configure the app

[`.env.example`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vault/.env.example) lists the variables. WalletConnect works as in [amulet-vesting](https://github.com/BootNodeDev/canton-dappbooster/tree/main/example-dapps/amulet-vesting#configure-the-app).

### Use your own network

Point `.env` at your network: `CANTON_JSON_API_URL`, `CANTON_BACKEND_TOKEN` and the `VITE_` URLs. Then run:

| Script | What it does |
| --- | --- |
| `pnpm bootstrap` | uploads the DARs, creates the issuer and vault parties, both tokens and the vault |
| `pnpm stack:up` | starts the vault operator (`pnpm stack up` runs it for you on the local network) |
| `pnpm dev` | serves http://localhost:3012 |

`bootstrap` creates only what is missing, so running it again is safe. It writes no file. `pnpm stack:down` stops the operator, and its log is in `.dev-stack/vault-operator.log`.

> [!IMPORTANT]
> The dApp finds the vault through the rights of the user your wallet signs in as, and reads both tokens as their issuers. On the local network that user is `ledger-api-user`, the same one `bootstrap` grants rights to. On another network, the wallet's user needs `CanActAs` on the `vault-operator` party and at least `CanReadAs` on the `token-issuer` party.

### Change how often the operator reads the ledger

Set `VAULT_OPERATOR_POLL_MS` in `.env`, in milliseconds. It is 3000 by default.

[`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/example-dapps/token-vault/architecture.md) describes the app's internal structure and the reasoning behind it, including how the dApp and the operator find the vault on the ledger.
