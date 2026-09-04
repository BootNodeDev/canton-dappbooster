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
- `api/` sits beside `src/`, not inside it. Vercel publishes each module there at `/api/<basename>`,
  so the path is the route and moving one renames the endpoint. Server-side code: it never imports
  from `src/`, reads its configuration from `process.env`, and any variable it needs is deliberately
  not a `VITE_` name, since those are inlined into the bundle.

## Shared pieces to reach for

One implementation each, so a second one is a bug and not a choice:

- **Every interactive control is [Ark UI](https://ark-ui.com/react/docs/overview/introduction).**
  Menus, the dialog, tooltips, the select, toasts, the wizard's steps, the number input and the
  toggle groups are all Ark's, so nothing here re-derives dismissal, focus trapping or roving focus.
  What the app writes is the markup's classes and its wording. The rules the library leaves open are
  in [`architecture.md`](architecture.md).
- **Hover explanation: `components/InfoTip`.** Never a native `title` (a one-second delay, no touch,
  unstyled) and never a hand-rolled bubble. With a string child it dash-underlines the words; with an
  element it does not, so an icon trigger is a legal child. Childless it is a `?` badge. It adds the
  tap-to-open Ark leaves out.
- **A figure: `components/AmountDisplay`.** It owns the grouping, the forced two decimals, and the
  Amulet mark with its tooltip. `count` is the escape hatch for a tally, which owes neither.
  Where the surrounding text already spells out the unit, reach for `components/CompactAmount`, the
  same figure without the mark: it is what keeps the exact value in a tooltip and in the accessible
  name once an outsized amount is abbreviated, so a hand-rolled `formatFigureCompact` loses it.
- **Button classes on something that is not `components/Button`:** import `buttonClass`. The kit's
  own buttons take a `className` but cannot render ours. A button waiting on a submission takes
  `pending`, which owns the spinner, the wording and the disable together. The one exception is
  `TopBar/AccountMenu`'s trigger, which transcribes the kit's `.cnc-connect-button` instead so the
  header keeps one look across the two faces the session swaps between; `cn` is a plain join and
  cannot override a `buttonClass` variant, so there is no way to have both.
- **A choice out of a short, always-visible set: `components/Pills`.** One Ark toggle group behind
  two looks — `outline` for the dashboard's filters, `segmented` for the create form's curve switch.
  It reports the choice as a radio group, so the picked pill is a checked radio rather than a class
  name. A value picked from a dropdown is `components/Select`; a *view* picked from one is
  `components/RoleSelect`, which is a menu rather than a listbox because it commands the page
  instead of holding a value. All three panels take their surface from `utils/popover`.
- **A generic icon comes from `lucide-react`; `src/icons/` holds only the brand and house marks,**
  each named `*Mark`. `App.tsx` sets lucide's size and stroke width once through `LucideProvider`,
  so a call site passes `size` only where it wants something other than the shared default. The one
  wrapper is `components/Spinner`, which owns `animate-spin`: lucide ships no animation, and a
  second call site spelling that class out is how one of them ends up frozen.
- **A grant's badges: `components/CurvePill` and `components/GrantStatusPill`;** where a claim cannot
  be offered, `components/GrantLock`. Each owns its own wording, tone and base classes, so a caller
  passes alignment at most and never re-spells the mapping. There is no drained-grant badge: a
  withdraw that empties the escrow archives the contract, so the grant leaves the list entirely.
- **A blank state: `components/EmptyState`,** and `components/Loading` while a first read is in
  flight. `Loading` is for an empty collection only: a refresh after a write keeps its rows.
  `EmptyState` takes the heading rank the page leaves free: the default 2 sits under a `PageTitle`,
  and 1 is for a state that replaces the page and has no other heading above it.
- **A brand colour that has to be read: the `-strong` token.** `--primary`, `--accent` and `--pink`
  are fill and graphic values, and each falls below 4.5:1 as small text in one theme or the other.
  Text takes `text-primary-strong`, `text-accent-strong` or `bg-pink-strong`, defined per theme to
  clear AA; the plain tokens stay for fills, borders and gradients.

## Naming

- No name repeats what its folder, its parent, or its own markup already says. `Claim`, not
  `ClaimDialog`; `pages/Dashboard`, not `DashboardPage`. Where the word is the meaning rather than
  the mechanism it stays: `PageTitle` is a page's title wherever it is rendered from.
- Type and interface members are alphabetical, as in `canton-dappbooster`. Blank-line groups inside
  a declaration are sorted within the group.
