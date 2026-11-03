# @bootnodedev/canton-dappbooster

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. This package is its UI components layer, headless and unstyled. The complete kit, the installer and the guides live at [dappbooster.cc](https://dappbooster.cc).

Reusable UI components for Canton dApps: reading Canton identifiers (display, truncation, copy-to-clipboard, explorer links) and entering them (validated party-id input). Amounts are the other half: a token-amount field, plus the exact-decimal utilities under it, because a `number` cannot carry a Canton amount without losing digits.

The API reference is at [components.dappbooster.cc](https://components.dappbooster.cc/).

## Installation

With npm:

```bash
npm install @bootnodedev/canton-dappbooster @bootnodedev/canton-connect @canton-network/dapp-sdk @walletconnect/sign-client
```

With pnpm:

```bash
pnpm add @bootnodedev/canton-dappbooster @bootnodedev/canton-connect @canton-network/dapp-sdk @walletconnect/sign-client
```

## Styling: components carry none

The components (L2) have no styling opinion at all. Styling comes from the separate [`@bootnodedev/canton-theme`](https://github.com/BootNodeDev/canton-dappbooster/tree/main/canton-theme) package (L3), which you import yourself:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

The contract between the two is the DOM each component renders, not code. The reasoning is in [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md).

## Light / dark / system

This is the one styling-related runtime the package does ship. `<ThemeProvider>` owns the mode and writes `data-theme` on `<html>`, which is the attribute the theme keys its dark values on. `useTheme()` reads and sets it. No token names live here.

> [!NOTE]
> On a reload the page background flashes before React applies the attribute, and this package ships nothing to prevent that. See [Theme runtime](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md#theme-runtime) in `architecture.md` for why.

> [!WARNING]
> Client only: the provider reads the OS preference when it mounts, so a server render throws.

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

## Working on the package

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | tsdown build into `dist/`: ESM `index.js` and `connect.js`, each with its `.d.ts` |
| `pnpm test` | vitest with jsdom and Testing Library, run against `src` |
| `pnpm typecheck` | `tsc --noEmit` |

### Build & dev loop

tsdown emits ESM and `.d.ts` files into `dist/`. The components carry no CSS, so `sideEffects: false` is safe and the bundle tree-shakes. The `exports` map has a `development` condition that points at `src`, so Vite serves the source directly in dev. Production builds and the published package use `dist`.

In dev, a consumer resolves and typechecks against the source, with no kit build needed. Its production build resolves `dist`, so build the kit first, or run `pnpm build` from the repo root, which builds the workspaces in order.

React 19 only, both as a peer and as a dev dependency.

> [!WARNING]
> If the consumer's React resolves to a different copy than the kit's, you get two Reacts in one bundle. Hooks then read a null dispatcher and every render throws. You only see this in a production build, because the `development` condition resolves the kit to its source. The fix is `resolve.dedupe` in the bundler.
