# Agent Configuration — example-dapps/amulet-vesting

This file applies only to `example-dapps/amulet-vesting/`. The rules every example shares are in
[`../CLAUDE.md`](../CLAUDE.md), and the repo-wide ones in [`../../CLAUDE.md`](../../CLAUDE.md). The
internal seams are in [`architecture.md`](architecture.md). Deltas for this app only are below.

- No server code, and so no folder beside `src/` for it: this app is a static bundle, `vercel.json`
  answers every path with `index.html`, and every call goes straight to the service answering it.
- The Daml package sits directly in `daml/`, not in a folder named after itself, so a rename
  touches `daml/daml.yaml` and nothing else.
- The token's mark on every figure is the Amulet mark, `assets/canton-coin.png`, through `AMT` in
  `utils/tokens.tsx`.
