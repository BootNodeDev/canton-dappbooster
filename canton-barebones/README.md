# Canton Barebones

> **Superseded and inert.** The local Canton stack is
> [`@bootnodedev/canton-barebones`](https://github.com/BootNodeDev/canton-barebones), run from a
> directory of its own, and wallet-service moved to
> [its own repository](https://github.com/BootNodeDev/canton-wallet-service). Nothing here starts
> anything; the bring-up is in the root [README](../README.md) and the seams in
> [`architecture.md`](../architecture.md).

What is left, pending this directory's removal:

- `config/splice/` — the compose overrides that disabled the app-provider Nginx routes, read by the
  deleted `splice-common.sh`.
- `dars/vesting-lite-0.0.1.dar` — a prebuilt DAR from when deploying without `dpm` was supported.
  `dpm` is a prerequisite of the local loop now, so build from source instead:
  `pnpm run build-dar`.
- `.env.example` — the Splice compose configuration. The one `.env` that matters is at the repo
  root.
