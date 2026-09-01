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
- `src/index.ts` is the public API, `src/connect.ts` the `/connect` sub-path barrel. Nothing else is
  importable by consumers. A component that imports `@bootnodedev/canton-connect` goes in
  `connect.ts`, never `index.ts`: the barrel is the whole Canton SDK's entry point into a consumer's
  graph, and under the `development` condition nothing tree-shakes it back out.
  Merging the two barrels would trade a guarantee for a hope, so do not, however tidy it looks. Two
  entry files mean a consumer importing only `index` *cannot* have the SDK in their bundle. Merged,
  they would need tree-shaking to reach through a re-export chain into `@canton-network/dapp-sdk`,
  which declares no `sideEffects` field at all, so a bundler must keep the whole package once its
  import survives into the graph. This package's own `sideEffects: false` does not help there.
  The generated reference already lists the wallet buttons beside the other components, so there is
  no documentation argument for collapsing the split either; see the root `CLAUDE.md`.
- Nothing in `src/providers/` renders DOM of its own, so those folders carry no theme rules and no
  part classes: there is no markup to style. The authoring steps below are for components that
  render. A provider that writes an attribute the theme selects on still owes an `anatomy.ts`,
  states only and no `parts`, and writes the attribute through it — `ThemeProvider` and `data-theme`
  are the case. Rendering nothing and placing no selector are different things, and only the second
  earns the exemption.
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
   A slot filled by *another* kit component gets a part too, passed to it as `className`, so the
   theme selects a compound on one element rather than reaching down from an ancestor. A descendant
   selector would restyle every instance a consumer ever nests there, and leaves the DOM contract
   incomplete for anyone theming it themselves.
   The `anatomy` const itself is never exported from `src/index.ts` or `src/connect.ts`: the DOM it
   describes is the contract, and exporting the strings would owe consumers a stable object too.
   Instead the component's own doc block carries one line pointing at it, so a reader of the
   generated reference can still reach the parts and states:
   `@see [anatomy.ts](<blob URL of the component's anatomy.ts>) for the part classes and state attributes the theme selects.`
   One line per component, naming the file, even where the folder declares a second anatomy.
   Absolute, per the link rule in the root `CLAUDE.md`: a relative path is republished as a copy the
   host serves as `video/mp2t`, so the link downloads instead of showing the source it exists for.
   `pnpm docs:check` requires the line wherever an `anatomy.ts` sits beside the file, which is why
   `ThemeProvider` carries one and the other two providers do not — placing a selector is what earns
   it, not rendering markup. Because the URL is absolute, typedoc's `invalidPath` validation cannot
   see a moved file, so the check matches the path inside it and a rename has to update both.
   `pnpm check:anatomy` is what keeps the strings and the theme in step.
2. **`index.tsx`** — take class names from `anatomy.parts.*`, merged with the consumer's `className`
   through `cx` from `src/utils/cx.ts`; never hand-roll the join. No CSS import. Keyboard-heavy
   widgets hand-roll on Zag prop-getters; display primitives use plain React state.
3. **Theme styles** — add the part-class rules to `canton-theme`'s `default.css` (under
   `@layer cnc`, reading `var(--cnc-*)`); add any new tokens to its `tokens.css`.
4. **Test** — the contract the root rule says to assert against is `anatomy.parts.*` here. A state
   the theme styles but no role or accessible name carries needs a live-region part; see `status` on
   `<Identifier>`.
5. **Export** from `src/index.ts`, or from `src/connect.ts` if it reads the wallet session.

## Working Rules

- **A component owns no user-facing copy it cannot justify.** Hardcoded English is as much an L3
  decision as a colour, and there is no i18n seam here. Where a caller passes `children`, they win in
  every state the component has — `ConnectButton` renders them while pending too, and supplies its
  own two strings only when a caller passes none; `WalletButton` hands them to the face it picks.
  State stays the component's: the spinner and `data-pending` are rendered independently of the
  words.
- Components import no CSS. `sideEffects: false` depends on it.
- `tsconfig.json`'s `customConditions: ["development"]` is load-bearing: without it
  `@bootnodedev/canton-connect` resolves through its `types` entry into `dist/`, which is
  gitignored, and CI typechecks before it builds. It passes locally either way, because a `dist/`
  from an earlier build is sitting there.
- Keep this package app-agnostic: do not import from `dapp/`.
- React 19 only, peer and dev alike.
- `dapp/frontend` keeps its own copy/check icons in its `src/icons/`. Leave them: the kit's
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
