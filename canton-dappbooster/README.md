# @bootnodedev/canton-dappbooster

Reusable UI components for Canton dApps — identifier display, copy-to-clipboard actions,
explorer links, and related building blocks.

`src/index.ts` is the public API, and every export carries JSDoc that your editor will surface at
the call site. Authoring rules for new components live in [`CLAUDE.md`](CLAUDE.md).

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

React 19 only, peer and dev alike. Components take `ref` as an ordinary prop.

A consumer whose React resolves to a different copy than the kit's ends up with two Reacts in one
bundle, where hooks read a null dispatcher and every render throws. Only a production build shows
it, since the `development` condition resolves the kit to source. `resolve.dedupe` in the bundler
is the fix.

## Styling: components carry none

Components (L2) ship zero styling opinion. Styling lives in the separate
[`@bootnodedev/canton-theme`](../canton-theme) package (L3), which consumers import explicitly:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

The contract between the two is the DOM each component renders — not code. See
[`architecture.md`](architecture.md) for the seam and the reasoning.

## Light / dark / system

The one styling-adjacent runtime this package does ship. `<ThemeProvider>` owns the mode and writes
`data-theme` to `<html>`, which is what the theme keys its dark values on; `useTheme()` reads and
sets it. No token names live here.

A reload flashes the page background before React applies the attribute, and this package ships
nothing to prevent it. [`architecture.md`](architecture.md) has the reasoning.

Client-only: the provider reads the OS preference as it mounts, so a server render throws.

```tsx
import { ThemeProvider, useTheme } from '@bootnodedev/canton-dappbooster'

const App = () => (
  <ThemeProvider>
    <Page />
  </ThemeProvider>
)

const ModeToggle = () => {
  const { resolved, toggle } = useTheme()
  return <button onClick={toggle}>{resolved === 'dark' ? 'Light' : 'Dark'}</button>
}
```
