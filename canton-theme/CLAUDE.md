# Agent Configuration — canton-theme

This file applies only to `canton-theme/`. For monorepo-wide rules see [`../CLAUDE.md`](../CLAUDE.md);
for the L2/L3 seam this package sits on, [`../canton-dappbooster/architecture.md`](../canton-dappbooster/architecture.md).
Deltas for this package only are below.

## Scope

Plain CSS. No JavaScript, no build step, no dependencies. Two independently consumable files:

- `src/tokens.css` — the `--cnc-*` custom properties. This file *is* the token contract; do not
  mirror its contents into prose anywhere.
- `src/default.css` — prestyled defaults selecting on the part classes and states each component
  declares in its `anatomy.ts`.

## Naming a token

`--cnc-<role>[-<variant>]`, lower-kebab.

- The `--cnc-` prefix is the public contract. An unprefixed property is not themeable and must not
  appear in `default.css`.
- **Name the role, never the appearance or the component.** `--cnc-text-muted`, not `--cnc-grey`
  (appearance drifts when the palette changes) and not `--cnc-identifier-copy` (a token every
  component can read is the point).
- Roles: `bg`, `surface`, `text`, `border`, `accent`, and the state roles `success`, `warning`,
  `danger`.
- Variants modify a role:
  - `-muted` / `-strong` — same kind as the base, less or more emphasis. `--cnc-text-muted` is
    still a text colour; `--cnc-surface-muted` is still a surface.
  - `-subtle` — a pale *fill* derived from a role whose base value is a foreground colour, for
    badges and callouts. `--cnc-danger` is the text, `--cnc-danger-subtle` the wash behind it.
  - `-hover` — the same role under interaction.
  - `-fg` — the text colour that sits *on* that role's fill (`--cnc-accent-fg` over `--cnc-accent`).
- Colour and shape only. No spacing or typography scale until a component needs one; adding a scale
  is a contract decision, not a convenience.

## When a token earns existence

The role grid above is declared ahead of use, in full and in both modes. A component author picks a
name off it instead of inventing one, which is the only way `--cnc-surface-muted` and
`--cnc-accent-subtle` end up meaning the same thing in two components written months apart. So
`tokens.css` legitimately declares tokens `default.css` does not yet read.

What must earn its existence is a name *outside* the grid — a new role, a new variant, or a
component-specific value. That is a contract decision: it is public the moment it ships, and we keep
it forever. Prefer an existing role; if none fits, add the variant to the grid across every role it
makes sense for, not just the one component that needed it.

## Dark mode

Dark values hang off `[data-theme="dark"]`, never `@media (prefers-color-scheme: dark)` alone. A
runtime that lets the user choose light *on a dark OS* has to be able to win, and it cannot override
a media query. The attribute must decide in both directions.

Every token in `:root` needs a dark counterpart unless it is mode-independent by construction
(radius, font stack).

## Writing default.css

- Everything under `@layer cnc`, so consumer CSS wins without specificity fights.
- Every `var()` carries a fallback. `default.css` must render standalone when `tokens.css` is absent.
- Select only on parts and states a component actually renders. `anatomy.ts` in
  [`../canton-dappbooster`](../canton-dappbooster) is the source of truth; never invent a selector.

## Validation

- `pnpm lint` from the repo root (Biome checks CSS; there is no local Biome config).
- Kit components render against this theme in `dapp/frontend` on port 3012, which is where a
  palette change gets looked at.
