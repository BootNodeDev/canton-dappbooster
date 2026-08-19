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

## Layering

Both files go entirely inside `@layer cnc`. Unlayered CSS beats layered CSS whatever the
specificity, so a consumer overrides anything here with a plain rule and it holds whether they
import us first or last. Import order must never be load-bearing.

Never use `!important`. Inside a layer it inverts: a layered `!important` beats an unlayered one, so
a single one here would be unbeatable from outside the package.

## Naming a token

`--cnc-<role>[-<variant>]`, lower-kebab.

- The `--cnc-` prefix is the public contract. An unprefixed property is not themeable and must not
  appear in `default.css`.
- **Name the role, never the appearance or the component.** `--cnc-text-muted`, not `--cnc-grey`
  (appearance drifts when the palette changes) and not `--cnc-identifier-copy` (a token every
  component can read is the point).
- Colour roles: `bg`, `surface`, `text`, `border`, `overlay`, `accent`, `swatch`, and the state roles
  `success`, `warning`, `danger`. Shape roles: `radius`, `font-mono`. `overlay` is the scrim a
  layer above the page sits on, so it is the one role whose value is translucent by definition.
- `swatch` is the one numbered role: `--cnc-swatch-1` … `--cnc-swatch-8` and their `-fg`, a
  categorical palette for a placeholder standing in for artwork that does not exist (a token with no
  logo). Anything picking one hashes an identifier to the index and puts it in a `data-*`; the
  colour never crosses back into JavaScript, so it still follows the mode.
- Variants modify a role:
  - `-muted` / `-strong` — same kind as the base, less or more emphasis. `--cnc-text-muted` is
    still a text colour; `--cnc-surface-muted` is still a surface. Emphasis is a colour axis, so
    neither variant applies to `radius`: a second corner is a size scale, which the grid has not
    got and which no single component earns.
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
a media query. The attribute must decide in both directions. That runtime is `<ThemeProvider>` in
[`../canton-dappbooster`](../canton-dappbooster); the attribute is the whole contract between them,
and this package stays free of JavaScript.

Every token in `:root` needs a dark counterpart unless it is mode-independent by construction
(radius, font stack).

`color-scheme` follows the same rule and is the one non-token declaration here: it hands the browser
the mode for the surfaces we cannot style (scrollbars, form controls, the caret). One explicit value
per mode. Never `color-scheme: light dark`, which defers to the OS and so undoes the attribute in
exactly the case the attribute exists for.

## Writing default.css

- No `var()` fallbacks. `default.css` opens by importing `tokens.css`, so every default is declared
  once; a fallback would be a second copy that drifts and that nothing checks.
- Select only on parts and states a component actually renders. `anatomy.ts` in
  [`../canton-dappbooster`](../canton-dappbooster) is the source of truth; never invent a selector.
- Put colour on the root part, never on the inner value part, so a consumer's utility class on the
  root still wins.
- Never declare `font-size` on a primitive that can sit inside a heading, a row, or a table cell.
  Let it inherit, and size sub-parts in `em` so they scale with whatever they land in.
- A field nested in a card takes `--cnc-border-strong`: it shares the card's surface, so the card's
  own border colour on it reads as the card edge rather than as a field.
- A wide field shows focus and invalidity by tinting its own border under a translucent wash, not by
  adding a detached solid ring. The wash carries the thickness contrast needs; a 2px ring standing
  off a field that wide reads as an error even when nothing is wrong.
- The token part is `align-self: stretch`, so the symbol takes its height from the amount field
  beside it instead of from its own padding, and the two stay level when the field is resized.
- The token select's list is a fixed `20rem`, expressed as `flex: 0 1 20rem` with `min-height: 0` and
  never as `height`: a flex item that cannot shrink pushes the card past its own `max-height` on a
  short viewport, and the card has no scroll of its own to catch the spill. It is `rem` and not `px`
  because the rows it windows are measured in `rem` too, from `ROW_HEIGHT_REM`.
- The token select's list takes `overscroll-behavior: contain`. Reaching either end of a scroller
  inside a dialog must not start scrolling the page behind it, which the user cannot see moving.
- The token select's favourites are ruled off from the list by their own `border-bottom`, not a
  separate element, and the margin above matches the padding below so the rule sits centred in the
  gap it divides.
- The favourites row wraps and never scrolls. `MAX_FAVORITES` in
  [`../canton-dappbooster`](../canton-dappbooster) is what bounds its height, so the row cannot push
  the card past its own `max-height` — which is the spill the list's `flex: 0 1 20rem` exists to
  prevent. Do not give this row a scroller to make room for more chips; raise or keep the cap.
- The favourite chip and the token field's own token part share one rule, because they are the same
  object rendered twice. What differs is a chip's border and cursor, and that the field's part
  stretches to the amount input beside it.
- The favourite chip's logo is selected as `.cnc-token-logo.cnc-token-select-dialog__favorite-logo`,
  a compound and not a descendant, because both classes land on the same element and the tie with
  `.cnc-token-logo` further down would otherwise go to source order.
- Shrinking that disc to `1.5rem` leaves `[data-fallback]`'s `0.6875rem` font-size, which was sized
  for the `2rem` disc, so a 3-letter placeholder ("USD") can touch the disc edge in a wide font.
  Accepted, and it is the common case rather than the rare one: a token with artwork is the
  exception in the lists we have. Scale the font-size here when it starts clipping.
- The favourite chip hovers to `--cnc-accent-subtle`, not to `--cnc-surface` the way a list row does.
  A row sits on `--cnc-surface-muted` so `--cnc-surface` reads as emphasis; a chip sits on the card,
  which already is `--cnc-surface`, so the same value would erase the chip instead. That wash was
  the token select's selected-row fill until the current-row marking was dropped, so a consumer who
  tuned it to read as "your current token" now meets it under the pointer.
- The token select's rows are sized by L2, from `ROW_HEIGHT_REM`, and the windowing maths multiplies
  it. A theme may restyle a row; it may not resize one. A height, a border or a `min-height` here
  puts the sizer and the row offsets into silent disagreement and rows drift out of their slots.
- The list takes no `scroll-behavior: smooth`. Scroll writes go straight to `scrollTop` and the
  rendered window is computed for the destination, so a smooth scroll would animate against a
  window that has already arrived.
- The token select's "no tokens found" part renders only while the list is empty, so it needs no
  rule collapsing it. What announces the change is a separate live region the component hides
  inline and out of flow; never style it with `display: none`, which drops a live region out of the
  accessibility tree and silences the announcement it exists for.
- `z-index` appears once, on the token select dialog's backdrop and positioner, because those two sit
  above the page instead of in it. Everything else stacks in document order; a second value here
  means two components can fight over depth, so treat adding one as a contract decision.
- Comments: root [`../CLAUDE.md`](../CLAUDE.md) allows only section separators. A stylesheet fact
  worth keeping is written into this file instead, under the section that owns it.

## Validation

- `pnpm lint` from the repo root (Biome checks CSS; there is no local Biome config).
- Kit components render against this theme in `dapp/frontend` on port 3012, which is where a
  palette change gets looked at.
