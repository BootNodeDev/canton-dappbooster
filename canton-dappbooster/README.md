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

tsdown builds ESM + `.d.ts` with `css: { inject: true }`, so a component's `import './X.css'` is
preserved and consumers auto-load styles. `exports` carries a `development` condition → `src`, so
Vite serves source live in dev; `dist` is used for production and publish.

Consumers resolve source in dev and typecheck (no kit build needed); their production build resolves
`dist`. Build the kit first, or run `pnpm build` from the repo root, which builds workspaces in order.

## Styling convention

Plain CSS + CSS custom properties — no Tailwind, no CSS-in-JS.

- **Tokens:** every color / font / radius uses `var(--cnc-*, <fallback>)`, so a component renders
  with no theme installed and themes when a consumer defines the tokens.
- **Cascade layer:** default styles live in `@layer cnc { … }` so consumer CSS wins.
- **Part classes:** stable `.cnc-<component>*` hooks; state on `data-*` / `aria-*`.
- One CSS file per component, imported by the component.
