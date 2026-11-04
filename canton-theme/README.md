# @bootnodedev/canton-theme

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

A plain-CSS theme (L3) for the [`@bootnodedev/canton-dappbooster`](https://github.com/BootNodeDev/canton-dappbooster/tree/main/canton-dappbooster) components. No JavaScript and no runtime. It exports:

| Export | What it is |
| --- | --- |
| `@bootnodedev/canton-theme/tokens.css` | the `--cnc-*` custom properties, which are the theming and dark-mode contract |
| `@bootnodedev/canton-theme/default.css` | prestyled defaults that select on the component part classes; imports `tokens.css` |

## Installation

With npm:

```bash
npm install @bootnodedev/canton-theme
```

With pnpm:

```bash
pnpm add @bootnodedev/canton-theme
```

## Usage

The components ship no styling. Import the theme once, at your app entry:

```ts
import '@bootnodedev/canton-theme/default.css'
```

`default.css` imports `tokens.css`, so that one line is the whole theme. Import `tokens.css` on its own if you want the contract without the prestyled defaults.

> [!WARNING]
> If you define the `--cnc-*` properties yourself, set `color-scheme` too, one explicit value per mode. It is not a `--cnc-*` property, and without it the browser paints scrollbars, form controls and the caret in the wrong mode.

Dark mode turns on with `[data-theme="dark"]` on `<html>`. The theme deliberately ignores `prefers-color-scheme` on its own, so that a mode toggle can override the OS preference in either direction. The `<ThemeProvider>` in [`canton-dappbooster`](https://github.com/BootNodeDev/canton-dappbooster/tree/main/canton-dappbooster) drives the attribute from React, but nothing here depends on it, and setting the attribute yourself works just as well.

> [!NOTE]
> Set `data-theme` as early as you can: setting it after first paint flashes.

> [!WARNING]
> When you override a token, override it in both modes. Your `:root` block beats our `[data-theme="dark"]` block, so a light-only override stays in effect in dark mode.

Everything in the package sits in `@layer cnc`, so any unlayered CSS of yours wins without a specificity fight, whether you import the theme first or last.

### With Tailwind

> [!WARNING]
> Tailwind controls the order of the layers it emits, and its preflight resets `button { color: inherit }`, which overrides the theme's colors on the copy controls.

Place the `cnc` layer yourself, declaring the order before the first `@import`:

```css
@layer properties, theme, base, cnc, components, utilities;

@import "tailwindcss";
```

Any layer Tailwind emits that is missing from that statement ends up above the ones you listed, so keep `properties` (its `@property` polyfill) in the list.

Why the theme is a package of its own is in canton-dappbooster's [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md).
