# @bootnodedev/canton-theme

Plain-CSS theme (L3) for [`@bootnodedev/canton-dappbooster`](../canton-dappbooster) components. Zero
JavaScript, zero runtime. Two independently consumable artifacts:

| Export | What it is |
| --- | --- |
| `@bootnodedev/canton-theme/tokens.css` | `--cnc-*` custom properties — the theming + dark-mode contract |
| `@bootnodedev/canton-theme/default.css` | prestyled defaults selecting on component part classes |

## Usage

Components ship no styling; import the theme once at your app entry:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

- `default.css` carries token fallbacks, so it renders standalone. Load `tokens.css` too (or
  define the `--cnc-*` properties yourself) to theme and to support dark mode. Defining them
  yourself also means setting `color-scheme` directly, one explicit value per mode: it is not a
  `--cnc-*` property, so skipping it leaves the browser painting scrollbars, form controls, and the
  caret in the wrong mode.
- Dark mode activates on `[data-theme="dark"]`. Set that attribute on `<html>`, as early as you can:
  applied after first paint it flashes. It deliberately does not follow `prefers-color-scheme` by
  itself, so that a mode toggle can override the OS preference in both directions.
  [`canton-dappbooster`](../canton-dappbooster)'s `<ThemeProvider>` drives it from React; nothing
  here depends on that, and setting the attribute yourself is equally valid.
- Overriding a token means overriding it in both modes. Your `:root` also beats our
  `[data-theme="dark"]` block, so a light-only override stays applied in dark.
- The whole package lives under `@layer cnc`, so any unlayered CSS of yours wins without specificity
  fights, whether you import us first or last.

With Tailwind, position the `cnc` layer explicitly. Tailwind otherwise owns the layer order it
emits, and its preflight resets `button { color: inherit }`, which beats the theme's copy-control
colours. Declare the order yourself, before the first `@import`:

```css
@layer properties, theme, base, cnc, components, utilities;

@import "tailwindcss";
```

Any layer Tailwind emits that the statement omits lands on top of the ones it names, so keep
`properties` (its `@property` polyfill) in the list.

## Why a separate package

Components (L2) carry zero styling opinion; the theme (L3) is a separate concern styling the DOM
contract each component declares in its `anatomy.ts`. See
[`../canton-dappbooster/architecture.md`](../canton-dappbooster/architecture.md).
