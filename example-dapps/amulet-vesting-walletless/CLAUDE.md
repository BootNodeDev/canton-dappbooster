# Agent configuration: `example-dapps/amulet-vesting-walletless`

This file applies only to `example-dapps/amulet-vesting-walletless/`. The rules every example
shares are in [`../CLAUDE.md`](../CLAUDE.md), and the repo-wide ones in
[`../../CLAUDE.md`](../../CLAUDE.md). The internal seams are in [`architecture.md`](architecture.md).
Deltas for this app only are below.

## The server

- **`server/` sits beside `src/` because there is no wallet.** It holds the accounts, the sessions
  and the one ledger token, and acts on the ledger as each account's party. The browser holds a
  session cookie and nothing else.
- **Server modules reach each other through `#server/*`**, the sub-path imports in `package.json`,
  never a relative specifier. Node runs the `.ts` files as they are, with no build step, so every
  file in `server/src/` stays erasable TypeScript (`erasableSyntaxOnly`).
- **`server/` never imports from `src/`, and `src/` imports from `server/` only types**
  (`import type … from '#server/domain/types'`). The domain types live on the server because the
  API hands them over as JSON, so one definition makes a renamed field a type error on both sides.
- **`actAs` always comes from the session, never from a request body.** The participant user the
  server acts through may act as every account's party, so keeping each request to its own party is
  the server's job alone. A route that reads a party from the body is a bug.
- **Every environment read goes through `server/src/env.ts`.** It loads this folder's `.env`, lets an
  exported value win, and reads an empty value as the default.
- **The dApp has no `VITE_*` variables at all.** Anything it would read is the server's to know, and
  the Vite dev server proxies `/api` so the session cookie stays same-origin.
- **Server tests run on PGlite**, an in-process Postgres (`server/src/db/testDb.ts`), so
  `pnpm test` needs no Docker. A test never reaches the compose Postgres.

## The ledger

- **The participant caps a user at 1000 rights, and each account adds one.** Nothing may grant the
  server's participant user a right per request or per grant; that spends the account budget.
- **An account names a party, so a LocalNet reset orphans every account.** After
  `canton-barebones reset`, the accounts go too: `docker compose -f server/compose.yaml down -v`.
  `scripts/server.sh stop` keeps the volume on purpose, so accounts survive a `down` and `up` the way
  the ledger does.
- **`bootstrap` and `server/src/ledger/config.ts` agree on the `vesting-operator` hint.** The
  bootstrap reuses that party and its factory, and the server matches `vesting-operator::` only, so
  the stamped operators the wallet example creates on a shared LocalNet are never picked up.
