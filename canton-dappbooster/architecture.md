# Architecture — @bootnodedev/canton-dappbooster

The kit's structural seams and the contract every component follows. This is the "why";
the per-component authoring checklist is in [`CLAUDE.md`](CLAUDE.md). Repo-wide rules live in
[`../CLAUDE.md`](../CLAUDE.md).

This package is an MVP meant to lift into the parent project
([`canton-dappbooster_ON_HOLD_DO_NOT_DELETE`](https://github.com/BootNodeDev/canton-dappbooster_ON_HOLD_DO_NOT_DELETE)),
whose kit is a headless-components layer plus a separate plain-CSS theme. The decisions below
mirror the parent's `docs/decisions/0005-headless-behavior-approach.md` and
`docs/design/05-components-and-theme.md` so the lift stays mechanical.

## The layer split (L2 / L3)

Two packages, one contract between them — a DOM shape, not code:

| Layer | Package | Job |
| --- | --- | --- |
| L2 | `@bootnodedev/canton-dappbooster` (this package) | components — semantic markup, **zero styling opinion** |
| L3 | [`@bootnodedev/canton-theme`](../canton-theme) | plain CSS — `--cnc-*` tokens + prestyled defaults |

Components render the DOM contract (part classes + state attributes); the theme styles that
contract. Because the seam is the DOM, one theme serves any future binding, and a consumer can
style with the default theme, their own CSS, or nothing.

## The anatomy.ts contract

Each component declares its contract as code — a typed const of `parts` (CSS class hooks) and
`states` (the `data-*` / `aria-*` values styled off). It is the single source of truth: theme
selectors, test assertions, and docs all derive from it, so the behavior engine underneath can
change without breaking consumers. See `src/components/Identifier/anatomy.ts` for the reference shape.

The class strings live in `anatomy.ts`; the theme (a separate package) selects the same strings.
Keeping them aligned is manual for now — a parity check (the parent's `check:anatomy`) is future
tooling, not MVP scope.

## Behavior: Zag, hand-rolled — deferred until needed

The chosen behavior engine is **Zag** (framework-agnostic interaction state machines exposed as
prop-getters spread onto your own markup). Components are hand-rolled on those prop-getters, never
dropped in. The anatomy, not the engine, is the public contract.

Zag earns its place where the interaction is one HTML does not supply, such as a listbox with
roving focus, a popup with dismiss and outside-click, or a composite navigated by arrow keys.
Holding state is not the trigger; everything else is hand-rolled on plain React state. So the
`@zag-js/*` dependency lands with the first widget that needs it, not before; adding it now would
be an unused dependency.

`@zag-js/clipboard` is a genuine fit for `<Identifier>`'s copy control, and it still loses: it
models copied/not-copied but not a rejected write, which the `onCopy` outcome contract needs, and
it takes the value as machine config rather than per call, which a list of per-row copy controls
would pay for. Because the anatomy is the contract, the swap stays available: it would rewrite
`src/hooks/useCopyToClipboard.ts` and touch neither the parts, the props, the theme, nor the tests.
A real tooltip in place of the `title` attribute would flip that verdict immediately.

## Styling hooks

- **Parts** are semantic classes: `.cnc-<component>*`, BEM `__` for sub-parts (e.g.
  `.cnc-identifier`, `.cnc-identifier__copy`).
- **State** is the `aria-*` / `data-state` already on the element, so the styling hook and the
  accessibility state are one source of truth.
- **One exception to zero styling:** visually hiding a live region is functional, not decorative —
  a consumer running the kit with no CSS would otherwise get "Copied party id" in their layout. So
  the component applies that `sr-only` inline (see `SR_ONLY` in `Identifier/index.tsx`), the way
  Radix's `VisuallyHidden` does. The part class stays in the anatomy as a hook; nothing else is
  styled in L2.
- Tokens are `var(--cnc-*, <fallback>)`; the whole theme package is under `@layer cnc` so consumer
  CSS wins.
- Token naming convention and dark mode live in
  [`canton-theme/CLAUDE.md`](../canton-theme/CLAUDE.md).

## Theme runtime

`<ThemeProvider>` is the one runtime export that touches the L3 seam, and it touches it at exactly
one point: it writes `light` or `dark` to `data-theme` on `<html>`, which is the attribute the theme
keys its dark values on. It reads no token names and ships no CSS, so a consumer swapping the theme
out keeps the runtime.

The attribute is the contract, so a consumer can also drive it themselves and skip the provider.

The write happens in a layout effect, so the tree the provider wraps never paints in the wrong theme.
What still flashes is the page background, painted before the bundle runs. Closing that needs either a
script in `<head>` ahead of the bundle, which makes the consumer carry a pasted string, a build
plugin, or a server render, or a `prefers-color-scheme` fallback in L3 under
`html:not([data-theme])`, which [`canton-theme/CLAUDE.md`](../canton-theme/CLAUDE.md) neither forbids
nor rules on: it bans the media query *alone*, and a fallback stops matching the moment the provider
writes the attribute. Neither is built; the flash is accepted.

Anything but `light` or `dark` in storage means system, so a cleared or corrupt store degrades to the
OS preference rather than to a hardcoded mode.

Mode lives in React state rather than in the attribute, because `system` is not a value the attribute
can hold: it resolves to one of the other two and has to keep following `matchMedia`.

The provider is client-only. It reads the OS preference to pick its initial state, so a server render
throws rather than guessing a mode the client would then hydrate away from.

## Build & packaging

- **tsdown** builds ESM + `.d.ts` to `dist/`. Components import no CSS, so there is no CSS in the
  build — styling is the theme package's job.
- `sideEffects: false` — safe because no module has a side-effect import. (This is why the fused
  `import './X.css'` model was dropped: side-effect CSS imports and `sideEffects: false` are
  incompatible.) The theme package instead declares `sideEffects: ["**/*.css"]` so a consumer's
  `import '@bootnodedev/canton-theme/default.css'` survives tree-shaking.
- `exports` carries a `development` condition → `src` for live dev; `dist` is used for production.
  Stripping that condition before publish is enforced by `prepublishOnly` (publish hygiene is a
  separate future issue).

## Deferred (not this package's concern yet)

Open Props + Lightning CSS theme toolchain (tokens are hand-authored `--cnc-*` for now; aliasing
Open Props behind them later is non-breaking), the browser + axe test matrix, and publish hygiene.
