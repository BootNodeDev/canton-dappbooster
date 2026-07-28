# Architecture — @bootnodedev/canton-dappbooster

The kit's structural seams and the contract every component follows. This is the "why";
the per-component authoring checklist is in [`README.md`](README.md). Repo-wide rules live in
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
change without breaking consumers. See `src/placeholder/anatomy.ts` for the reference shape.

The class strings live in `anatomy.ts`; the theme (a separate package) selects the same strings.
Keeping them aligned is manual for now — a parity check (the parent's `check:anatomy`) is future
tooling, not MVP scope.

## Behavior: Zag, hand-rolled — deferred until needed

The chosen behavior engine is **Zag** (framework-agnostic interaction state machines exposed as
prop-getters spread onto your own markup). Components are hand-rolled on those prop-getters, never
dropped in. The anatomy, not the engine, is the public contract.

Zag earns its place at the keyboard-heavy widgets (wallet picker, token select). Display
primitives — `<Identifier>` (#6), explorer link (#9), hash (#10) — need no state machine and are
hand-rolled with plain React state. So the `@zag-js/*` dependency lands with the first widget that
needs it, not before; adding it now would be an unused dependency.

## Styling hooks

- **Parts** are semantic classes: `.cnc-<component>*` (e.g. `.cnc-placeholder`).
- **State** is the `aria-*` / `data-state` already on the element, so the styling hook and the
  accessibility state are one source of truth.
- Tokens are `var(--cnc-*, <fallback>)`; defaults live under `@layer cnc` so consumer CSS wins.
- Token naming convention and dark mode are owned by #19; the theme provider by #13.

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
