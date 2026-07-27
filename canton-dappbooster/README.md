# @bootnodedev/canton-dappbooster

Reusable UI components for Canton dApps — identifier display, copy-to-clipboard actions,
explorer links, and related building blocks.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | tsdown → `dist/` (ESM `index.js` + `index.d.ts`) |
| `pnpm test` | vitest (jsdom + Testing Library), against `src` |
| `pnpm typecheck` | `tsc --noEmit` |

## Build & dev loop

tsdown builds ESM + `.d.ts` to `dist/`. Components carry no CSS, so `sideEffects: false` holds and
the bundle tree-shakes cleanly. `exports` carries a `development` condition → `src`, so Vite serves
source live in dev; `dist` is used for production and publish.

Consumers resolve source in dev and typecheck (no kit build needed); their production build resolves
`dist`. Build the kit first, or run `pnpm build` from the repo root, which builds workspaces in order.

Dev-deps pin React 18 on purpose — the floor of the `^18.3.1 || ^19.0.0` peer range — so tests
exercise the lowest supported version. Consumers on React 19 (like `dapp/frontend`) compile the kit
against their own newer types.

## Styling: components carry none

Components (L2) ship zero styling opinion. Styling lives in the separate
[`@bootnodedev/canton-theme`](../canton-theme) package (L3), which consumers import explicitly:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

The contract between the two is the DOM each component renders — not code. See
[`architecture.md`](architecture.md) for the seam and the reasoning.

## Authoring a component

The reference is `src/placeholder/`. Each component follows the same shape:

1. **`anatomy.ts`** — declare `parts` (CSS class hooks, `.cnc-<component>*`) and `states`
   (`data-*` / `aria-*` values). This typed const is the single source of truth.
2. **Component `.tsx`** — render semantic markup; use `anatomy.parts.*` for class names; put state
   on `aria-*` / `data-state`. No CSS import. For keyboard-heavy widgets, hand-roll on Zag
   prop-getters; display primitives use plain React state.
3. **Theme styles** — add the part-class rules to `@bootnodedev/canton-theme`'s `default.css`
   (under `@layer cnc`, reading `var(--cnc-*)`); add any new tokens to its `tokens.css`.
4. **Test** — assert against `anatomy.parts.*`, not hard-coded strings, so the contract stays the
   single source of truth.
5. **Export** the component from `src/index.ts`.
