# @bootnodedev/canton-theme

Plain-CSS theme (L3) for [`@bootnodedev/canton-dappbooster`](../canton-dappbooster) components. Zero
JavaScript, zero runtime. Two independently consumable artifacts:

| Export | What it is |
| --- | --- |
| `@bootnodedev/canton-theme/tokens.css` | `--cnc-*` custom properties — the theming + dark-mode contract |
| `@bootnodedev/canton-theme/default.css` | prestyled defaults selecting on component part classes, under `@layer cnc` |

## Usage

Components ship no styling; import the theme once at your app entry:

```ts
import '@bootnodedev/canton-theme/tokens.css'
import '@bootnodedev/canton-theme/default.css'
```

- `default.css` carries token fallbacks, so it renders standalone. Load `tokens.css` too (or
  define the `--cnc-*` properties yourself) to theme and to support dark mode.
- All defaults live under `@layer cnc`, so your own CSS wins without specificity fights.

## Why a separate package

Components (L2) carry zero styling opinion; the theme (L3) is a separate concern styling the DOM
contract each component declares in its `anatomy.ts`. See
[`../canton-dappbooster/architecture.md`](../canton-dappbooster/architecture.md).
