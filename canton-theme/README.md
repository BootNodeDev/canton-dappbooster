# @bootnodedev/canton-theme

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. The installer, the guides and the rest of the stack live at [dappbooster.cc](https://dappbooster.cc).

A plain-CSS theme (L3) for the [`@bootnodedev/canton-dappbooster`](https://github.com/BootNodeDev/canton-dappbooster/tree/main/canton-dappbooster) components. No JavaScript and no runtime.

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

Import the theme once, at your app entry:

```ts
import '@bootnodedev/canton-theme/default.css'
```

`default.css` styles the component parts and imports `tokens.css`, the `--cnc-*` custom properties, so that one line is the whole theme. Import `tokens.css` alone for the tokens without the prestyled defaults.

## Dark mode

Dark mode turns on with `[data-theme="dark"]` on `<html>`. Set it as early as you can: setting it after first paint flashes.

The theme ignores `prefers-color-scheme` on purpose, so a toggle can override the OS preference either way.

## Overriding tokens

Everything sits in `@layer cnc`, so your unlayered CSS wins without a specificity fight, whatever the import order. To change a token:

```css
:root { --cnc-bg: #fafafa; }             /* light, and dark too without the next line */
[data-theme="dark"] { --cnc-bg: #111; }  /* dark */
```

> [!NOTE]
> If you define the `--cnc-*` properties yourself, set `color-scheme` too, one value per mode, or the browser paints scrollbars, form controls and the caret in the wrong mode.

## With Tailwind

Declare the layer order before the first `@import`, or Tailwind's preflight (`button { color: inherit }`) overrides the theme's colors on the copy controls:

```css
@layer properties, theme, base, cnc, components, utilities;

@import "tailwindcss";
```

Keep every layer Tailwind emits in that list, `properties` (its `@property` polyfill) included: a missing one ends up above the ones you listed.

canton-dappbooster's [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md) explains why the theme ships separately from the components.
