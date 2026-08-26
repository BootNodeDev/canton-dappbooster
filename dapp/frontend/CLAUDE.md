# Agent Configuration — dapp/frontend

This file applies only to `dapp/frontend/`. For monorepo-wide rules, including the filename casing
table and the colocate-then-promote placement rules it layers on, see [`../../CLAUDE.md`](../../CLAUDE.md).
The internal seams are in [`architecture.md`](architecture.md). Deltas for this app only are below.

## Layout

- Routed pages live in `pages/`, not `features/`. A page is a folder: `index.tsx` is the route, and
  whatever only that page composes sits beside it.
- **One consumer means colocate, and a page counts as a consumer.** `components/` holds what two or
  more places use; everything else lives beside the single thing that renders it, so
  `GrantCard` is `pages/Dashboard/GrantCard/`, not a flat file two folders away. A second consumer
  appearing is what promotes a module to `components/`, and that move is the whole change.
- A component earns a folder when it outgrows one file, never before: entry `index.tsx`,
  subcomponents PascalCase beside it, and anything both the entry and a subcomponent need in a
  camelCase leaf module (`CreateGrant/fields.ts`).
- A module that is both store and view splits along that seam: the store and its imperative API in
  `utils/`, the viewport in `components/` (`utils/toast.ts` and `components/Toaster/`).
- `providers/` names what it provides, not the role the folder already states: `Backend`, not
  `BackendProvider`.

## Naming

- No name repeats what its folder, its parent, or its own markup already says. `Claim`, not
  `ClaimDialog`; `pages/Dashboard`, not `DashboardPage`. Where the word is the meaning rather than
  the mechanism it stays: `PageTitle` is a page's title wherever it is rendered from.
- Type and interface members are alphabetical, as in `canton-dappbooster`. Blank-line groups inside
  a declaration are sorted within the group.
