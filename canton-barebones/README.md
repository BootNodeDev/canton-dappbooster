# Canton Barebones

Local Splice LocalNet wrapper for Canton dApp Booster.

This package starts the official Splice LocalNet bundle with:

```text
sv
app-user
wallet-service
```

It does not start:

```text
Keycloak/OIDC
```

It also does not start the app-provider UI containers. A local compose override
disables app-provider Nginx routes. The official shared Canton/Splice
containers still expose app-provider backend ports because the bundle bakes
that config in.

Splice and wallet-service share the `canton-barebones` Docker Compose project,
so Docker groups the full local stack together.

`app-user` is Splice's primary local validator name. It is not the Carpincho
user and not a product user.

## Start

```bash
cp .env.example .env
npm run token -- ledger-api-user
```

Paste the printed `CANTON_BACKEND_TOKEN=...` line into `.env`, then run:

```bash
npm run up
npm run health
```

From the repo root, use:

```bash
npm run canton:up
npm run canton:health
```

## Auth

The token script reads:

```text
CANTON_AUTH_AUDIENCE
CANTON_AUTH_SECRET
```

It prints a JWT. It does not edit `.env`. Pass a subject as the first argument
only if LocalNet expects something other than `ledger-api-user`.

Do not put `CANTON_AUTH_SECRET` in Carpincho. Generate a token and paste only
the token.

## Wallet Service

`npm run up` starts `wallet-service` after app-user is ready.

wallet-service points to app-user:

```text
JSON API   http://host.docker.internal:2975
Ledger API grpc://host.docker.internal:2901
Admin API  grpc://host.docker.internal:2902
```

Set `WALLET_SERVICE_MOCK=1` in `.env` to short-circuit Canton calls. Mock mode
does not require `CANTON_BACKEND_TOKEN`.

## Services And Ports

| Service | What It Is | URL / Port |
| --- | --- | --- |
| wallet-service | Carpincho bridge | `http://localhost:3010` |
| app-user Wallet UI | official Splice wallet UI | `http://wallet.localhost:2000` |
| app-user Ledger API | gRPC Ledger API | `grpc://localhost:2901` |
| app-user Admin API | gRPC Admin API | `grpc://localhost:2902` |
| app-user Validator API | Splice validator API | `http://localhost:2903` |
| app-user JSON API | JSON Ledger API | `http://localhost:2975` |
| app-user Validator proxy | wallet-sdk validator route | `http://localhost:2000/api/validator` |
| app-provider backend APIs | official bundle backend wiring, unused here | `grpc://localhost:3901`, `grpc://localhost:3902`, `http://localhost:3903`, `http://localhost:3975` |
| app-provider UI port | Nginx port exposed by the bundle; routes disabled here | `http://localhost:3000` |
| Scan UI | Splice explorer/read model | `http://scan.localhost:4000` |
| Scan API | indexed Splice API | `http://scan.localhost:4000/api/scan` |
| Amulet Registry | token metadata via scan proxy | `http://localhost:2000/api/validator/v0/scan-proxy` |
| SV UI | Super Validator operations UI | `http://sv.localhost:4000` |
| sv Ledger/Admin/JSON APIs | official SV participant APIs | `grpc://localhost:4901`, `grpc://localhost:4902`, `http://localhost:4975` |
| sv Validator API | SV readiness surface | `http://localhost:4903` |
| PostgreSQL | Splice LocalNet DB | `localhost:5432` |

If hostnames do not resolve, add:

```text
127.0.0.1 wallet.localhost scan.localhost sv.localhost
```

## Deploy a DAR

Compile a Daml project outside this base, then upload the DAR. From the repo
root, build and deploy any project and DAR with the same two commands:

```bash
npm run build-dar -- <path/to/daml/project>
npm run deploy-dar -- <path/to/file.dar>
```

For the in-repo Tally package that means:

```bash
npm run build-dar -- dapp/daml
npm run deploy-dar -- dapp/daml/.daml/dist/quickstart-tally-0.0.1.dar
```

Or call the upload script directly:

```bash
./scripts/deploy-dar.sh /path/to/app.dar
```

The script uploads to app-user:

```text
http://localhost:2975/v2/packages
```

`npm run canton:health` must return OK before deploying; otherwise the DAR upload can fail.
