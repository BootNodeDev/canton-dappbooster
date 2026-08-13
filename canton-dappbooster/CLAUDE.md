# Agent Configuration — canton-dappbooster

This file applies only to `canton-dappbooster/`. For monorepo-wide rules, including the
filename casing table and the colocate-then-promote placement rules, see
[`../CLAUDE.md`](../CLAUDE.md). Deltas for this package only are below.

## Scope

L2 headless components; styling is L3, in [`canton-theme`](../canton-theme). See
[`architecture.md`](architecture.md) for that seam and the reasoning behind it.

## Layout

`src/components/Identifier/` is the reference. On top of the root rules:

- `anatomy.ts` is a fixed, contractual filename inside a component folder, not a stylistic choice.
  It is the single source of truth for theme selectors, test assertions, and docs.
- Part classes are kebab-case regardless of the folder's casing: `Identifier/` renders
  `.cnc-identifier`, `ExplorerLink/` renders `.cnc-explorer-link`. BEM `__` for sub-parts.
- `src/index.ts` is the public API. Nothing else is importable by consumers.
- Nothing in `src/providers/` renders DOM of its own, so those folders have no `anatomy.ts` and no
  theme rules: there is no markup to style. The authoring steps below are for components that render.
- `src/icons/` sits at the root ahead of the second-consumer rule: an icon is never one component's,
  and its shared `Svg` wrapper has no component folder to belong to. One icon per file, named after
  its export — the root `biome.json` enforces that filename.

## Authoring a component

Root [`CLAUDE.md`](../CLAUDE.md) owns the general rules under Authoring a Component or Hook, including
accessibility and markup semantics. The styling contract they defer to is this:

`node scripts/add-component.mjs <Name>` from the repo root writes steps 1, 2, and 4 as stubs and
prints the two it will not edit for you, 3 and 5. It decides nothing below; it only saves the typing.

1. **`anatomy.ts`** — declare `parts` (CSS class hooks) and `states` (the `data-*` the theme selects
   on, keyed by role: `invalid`, not `rootInvalid`). This typed const is what the theme, the tests,
   and the docs all derive from. An `aria-*` is placed by the component but is never an entry; write
   it from the same value as its `data-*` so they cannot disagree (`src/utils/invalid.ts`).
2. **`index.tsx`** — take class names from `anatomy.parts.*`, merged with the consumer's `className`
   through `cx` from `src/utils/cx.ts`; never hand-roll the join. No CSS import. Keyboard-heavy
   widgets hand-roll on Zag prop-getters; display primitives use plain React state.
3. **Theme styles** — add the part-class rules to `canton-theme`'s `default.css` (under
   `@layer cnc`, reading `var(--cnc-*)`); add any new tokens to its `tokens.css`.
4. **Test** — the contract the root rule says to assert against is `anatomy.parts.*` here. A state
   the theme styles but no role or accessible name carries needs a live-region part; see `status` on
   `<Identifier>`.
5. **Export** from `src/index.ts`.

## Working Rules

- Components import no CSS. `sideEffects: false` depends on it.
- Keep this package app-agnostic: do not import from `dapp/` or `canton-barebones/`.
- React 19 only, peer and dev alike.
- `dapp/frontend` keeps its own copy/check icons in `components/icons.tsx`. Leave them: the kit's
  icons are internal, and exporting them is a public-API decision, not a deduplication chore.

## Testing

- Tests are colocated in `src`, beside what they cover.
- A test installs the state it needs and inherits none. `vitest.config.ts` sets `restoreMocks` and
  `unstubGlobals`, and `vitest.setup.ts` clears `localStorage` and the `data-theme` attribute after
  every test, so no stub, spy, or attribute from the test before it is ever load-bearing.
- `src/testing/` holds the helpers that install that state: `stubPrefersDark` for the OS colour
  preference, `stubClipboard` for `navigator.clipboard`, `stubViewport` for the element height and
  `ResizeObserver` a windowed list has to measure against, which jsdom supplies neither of. It also
  holds `TOKENS`, the fixture the token select's tests share so a name asserted in one file means
  the same token in the next.

## Validation Checklist

- `pnpm run lint`
- `pnpm test`
- `pnpm run typecheck`
