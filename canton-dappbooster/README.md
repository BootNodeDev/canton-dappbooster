# @bootnodedev/canton-dappbooster

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

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

It needs React 19.

## Styling: components carry none

The components (L2) have no styling opinion at all. Styling comes from the separate [`@bootnodedev/canton-theme`](https://github.com/BootNodeDev/canton-dappbooster/tree/main/canton-theme) package (L3), which you import yourself:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

The contract between the two is the DOM each component renders, not code. The reasoning is in [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md).

## Light / dark / system

`<ThemeProvider>` owns the mode: light, dark or system, the default, which follows the OS. It writes the resolved value, `light` or `dark`, to `data-theme` on `<html>`, the attribute canton-theme keys its dark values on.

`useTheme()` reads and sets the mode from any component inside the provider:

```tsx
import { ThemeProvider, useTheme } from '@bootnodedev/canton-dappbooster'

const ModeToggle = () => {
  const { resolved, toggle } = useTheme()

  return <button onClick={toggle}>{resolved === 'dark' ? 'Light' : 'Dark'}</button>
}

const App = () => (
  <ThemeProvider>
    <ModeToggle />
  </ThemeProvider>
)
```

> [!WARNING]
> Client only: the provider reads the OS preference when it mounts, so a server render throws.

## Working on the package

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | tsdown build into `dist/`: ESM `index.js` and `connect.js`, each with its `.d.ts` |
| `pnpm test` | vitest with jsdom and Testing Library, run against `src` |
| `pnpm typecheck` | `tsc --noEmit` |

An app in this repo runs against `src` in dev, with no build. Its production build reads `dist`, so run `pnpm build` here first, or from the repo root to build every workspace in order. How the build works is in [Build & packaging](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md#build--packaging).
