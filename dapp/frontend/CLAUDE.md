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

## Shared pieces to reach for

One implementation each, so a second one is a bug and not a choice:

- **Hover explanation: `components/InfoTip`.** Never a native `title` (a one-second delay, no touch,
  unstyled) and never a hand-rolled bubble. With a string child it dash-underlines the words; with an
  element it does not, so an icon trigger is a legal child. Childless it is a `?` badge.
- **A figure: `components/AmountDisplay`.** It owns the grouping, the forced two decimals, and the
  Canton Coin mark with its tooltip. `count` is the escape hatch for a tally, which owes neither.
  Where the surrounding text already spells out the unit, reach for `components/CompactAmount`, the
  same figure without the mark: it is what keeps the exact value in a tooltip and in the accessible
  name once an outsized amount is abbreviated, so a hand-rolled `formatCCCompact` loses it.
- **Button classes on something that is not `components/Button`:** import `buttonClass`. The kit's
  own buttons take a `className` but cannot render ours.
- **A blank state: `components/EmptyState`,** and `components/Loading` while a first read is in
  flight. `Loading` is for an empty collection only: a refresh after a write keeps its rows.

## Naming

- No name repeats what its folder, its parent, or its own markup already says. `Claim`, not
  `ClaimDialog`; `pages/Dashboard`, not `DashboardPage`. Where the word is the meaning rather than
  the mechanism it stays: `PageTitle` is a page's title wherever it is rendered from.
- Type and interface members are alphabetical, as in `canton-dappbooster`. Blank-line groups inside
  a declaration are sorted within the group.
