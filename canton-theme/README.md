# @bootnodedev/canton-theme

> [Canton dAppBooster](https://dappbooster.cc) is an open-source stack by BootNode for building Canton dApps on your own machine: a local Canton Network stack, wagmi-style hooks, UI components and CIP-0103 wallet support, wired together from the local network up to the UI. This package is its styling layer: the plain-CSS theme for those components. The complete kit, the installer and the guides live at [dappbooster.cc](https://dappbooster.cc).

A plain-CSS theme (L3) for the [`@bootnodedev/canton-dappbooster`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/README.md) components. No JavaScript and no runtime. It ships two files:

| Export | What it is |
| --- | --- |
| `@bootnodedev/canton-theme/tokens.css` | the `--cnc-*` custom properties, which are the theming and dark-mode contract |
| `@bootnodedev/canton-theme/default.css` | prestyled defaults that select on the component part classes; imports `tokens.css` |

## Usage

The components ship no styling. Import the theme once, at your app entry:

```ts
import '@bootnodedev/canton-theme/default.css'
```

- `default.css` imports `tokens.css`, so that one line is the whole theme. Import `tokens.css` on its own if you want the contract without the prestyled defaults. If you define the `--cnc-*` properties yourself instead, remember to set `color-scheme` too, one explicit value per mode. It is not a `--cnc-*` property, and without it the browser paints scrollbars, form controls and the caret in the wrong mode.
- Dark mode turns on with `[data-theme="dark"]`. Set that attribute on `<html>` as early as you can, because setting it after first paint flashes. The theme deliberately ignores `prefers-color-scheme` on its own, so that a mode toggle can override the OS preference in either direction. The `<ThemeProvider>` in [`canton-dappbooster`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/README.md) drives the attribute from React, but nothing here depends on it, and setting the attribute yourself works just as well.
- When you override a token, override it in both modes. Your `:root` block also beats our `[data-theme="dark"]` block, so a light-only override stays in effect in dark mode.
- Everything in the package sits in `@layer cnc`, so any unlayered CSS of yours wins without a specificity fight, whether you import the theme first or last.

With Tailwind, place the `cnc` layer yourself. Otherwise Tailwind controls the order of the layers it emits, and its preflight resets `button { color: inherit }`, which overrides the theme's colors on the copy controls. Declare the order before the first `@import`:

```css
@layer properties, theme, base, cnc, components, utilities;

@import "tailwindcss";
```

Any layer Tailwind emits that is missing from that statement ends up above the ones you listed, so keep `properties` (its `@property` polyfill) in the list.

## Why a separate package

The components (L2) carry no styling opinion. The theme (L3) is a separate concern that styles the DOM contract each component declares in its `anatomy.ts`. See [`architecture.md`](https://github.com/BootNodeDev/canton-dappbooster/blob/main/canton-dappbooster/architecture.md).
