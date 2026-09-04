# Architecture — @bootnodedev/canton-dappbooster

The kit's structural seams and the contract every component follows. This is the "why";
the per-component authoring checklist is in [`CLAUDE.md`](CLAUDE.md). Repo-wide rules live in
[`../CLAUDE.md`](../CLAUDE.md).

This package is an MVP meant to lift into the parent project
([`canton-dappbooster_ON_HOLD_DO_NOT_DELETE`](https://github.com/BootNodeDev/canton-dappbooster_ON_HOLD_DO_NOT_DELETE)),
whose kit is a headless-components layer plus a separate plain-CSS theme. The decisions below
mirror the parent's `docs/decisions/0005-headless-behavior-approach.md` and
`docs/design/05-components-and-theme.md` so the lift stays mechanical.

## The layer split (L2 / L3)

Two packages, one contract between them — a DOM shape, not code:

| Layer | Package | Job |
| --- | --- | --- |
| L2 | `@bootnodedev/canton-dappbooster` (this package) | components — semantic markup, **zero styling opinion** |
| L3 | [`@bootnodedev/canton-theme`](../canton-theme) | plain CSS — `--cnc-*` tokens + prestyled defaults |

Components render the DOM contract (part classes + state attributes); the theme styles that
contract. Because the seam is the DOM, one theme serves any future binding, and a consumer can
style with the default theme, their own CSS, or nothing.

## The anatomy.ts contract

Each component declares its contract as code — a typed const of `parts` (CSS class hooks) and
`states` (the `data-*` attributes the theme selects on). A `states` key names the role, never the
attribute: `invalid` is `data-invalid` in every component, whichever element ends up carrying it.
It is the single source of truth: theme selectors, test assertions, and docs all derive from it, so
the behavior engine underneath can change without breaking consumers. See
`src/components/Identifier/anatomy.ts` for the reference shape.

The `aria-*` a component writes is **not** an anatomy entry. It is placed for assistive tech, and
where a component puts it on an inner element while the theme needs the root, the two would collide
in one key. So the component writes both and only the `data-*` is the contract: `TokenInput` puts
`aria-invalid` on its field and `data-invalid` on its root, `PartyIdInput` puts both on the input
that is its root, and one `resolveInvalid` in `src/utils/invalid.ts` decides them together so the
pair cannot drift.

The class strings live in `anatomy.ts`; the theme (a separate package) selects the same strings.
Keeping them aligned is manual for now — a parity check (the parent's `check:anatomy`) is future
tooling, not MVP scope.

## Behavior: Zag, hand-rolled — one widget at a time

The chosen behavior engine is **Zag** (framework-agnostic interaction state machines exposed as
prop-getters spread onto your own markup). Components are hand-rolled on those prop-getters, never
dropped in. The anatomy, not the engine, is the public contract.

Zag earns its place where the interaction is one HTML does not supply, such as a listbox with
roving focus, a popup with dismiss and outside-click, or a composite navigated by arrow keys.
Holding state is not the trigger; everything else is hand-rolled on plain React state. So a
`@zag-js/*` dependency lands with the widget that needs it, never ahead of it: `@zag-js/dialog` and
`@zag-js/react` arrived with `<TokenInput>`'s token select. The React adapter reaches for
`react-dom` from `useMachine` down,
not only from `Portal`, and declares it a peer of its own, which is why `react-dom` joins `react` as
a peer dependency here; a consumer already has it, so nothing new is asked of them.

`@bootnodedev/canton-connect` is the third peer, and the one that does ask something. The three
components behind `/connect` read the wallet session from its hooks rather than from props, so they
throw without a `<CantonConnectProvider>` above them — the only components here requiring an
ancestor. That is the
price of one source of truth for the session: a prop mirroring it would let a caller contradict a
connect already in flight (see the authoring rules in the root `CLAUDE.md`). Every other component
in this package stays free of it.

Nothing unopened is paid for. The token select's trigger sits in `<TokenInput>`, outside the dialog,
so the dialog itself is mounting-is-opening and a field whose picker is never opened pays for no
machine, no scope and no dismiss listeners.

The trigger pays for that. Mounting *is* the open state, so the machine lives inside the dialog and
`<TokenInput>`'s symbol button cannot spread `api.getTriggerProps()`; it hand-rolls `aria-haspopup`,
`aria-expanded`, `aria-controls` and the click. It is therefore not the machine's registered trigger,
which costs two things: no `data-state` for the theme to style an open trigger with, and absence from
the dismiss layer's `exclude` list, harmless only because that layer blocks pointer events outside
itself while open. Lifting the machine into `<TokenInput>` buys the prop-getter back and charges
every field for a machine it may never open; the aria contract is duplicated instead, and drift
against Zag's on upgrade is the accepted risk.

`@zag-js/clipboard` is a genuine fit for `<Identifier>`'s copy control, and it still loses: it
models copied/not-copied but not a rejected write, which the `onCopy` outcome contract needs, and
it takes the value as machine config rather than per call, which a list of per-row copy controls
would pay for. Because the anatomy is the contract, the swap stays available: it would rewrite
`src/hooks/useCopyToClipboard.ts` and touch neither the parts, the props, the theme, nor the tests.
A real tooltip in place of the `title` attribute would flip that verdict immediately.

`@zag-js/number-input` is the same call for `<TokenInput>`, and loses on three counts. It implements
the WAI-ARIA spinbutton pattern, so the field would carry `role="spinbutton"` plus stepping and
pointer scrubbing, none of which belong on an amount nothing steps. Its callbacks and clamping run
on `valueAsNumber`, a double, which reintroduces exactly the precision loss the component exists to
avoid. And it rounds silently through `formatOptions.maximumFractionDigits`, where this component
flags instead. Zag landed with the token selector (issue #11) instead: a combobox and a dialog are
the real mistake to hand-roll.

## Windowing the token list: hand-rolled, and when to stop

The token select renders only the rows in view, on `useVirtualRows` and `useRemPx` inside the
component's folder rather than on a windowing library. The case is the narrowest one there is: one
list, uniform row height, vertical only, nothing measured. `@tanstack/react-virtual`, the default
choice, prices in variable heights, sticky items, windowing in both axes and a measurement cache,
none of which this list uses, and lands them in the bundle of every consumer of a package whose only
runtime dependencies so far are the `@zag-js/*` widgets above.

Focus is the second reason. The list walks on one roving tab stop, so a scroll that re-renders the
row holding focus has to hand it back, which is what `TokenList`'s layout effect and its stray row
do. That wants the scroll position and the rendered window moving together in a commit this package
controls, rather than coordinated against a library's own scroll writes and measurement cache.

No row is marked as the token the field is already on. The trigger that opened the dialog shows it,
so a highlighted row only repeats it, and that marking was the one thing forcing an identity onto the
field's token: without it `TokenMeta` needs no `id` and the dialog anatomy no `data-selected`. The
roving tab stop starts at the top rather than at that row, and focus is the only state a row carries.

The row height pays for all of it, so it has one home: `ROW_HEIGHT_REM`, written inline on the row by
L2 and read by the maths, in rem because a px row would clip a reader who scales their text up. The
sizer height and every row offset are multiples of it and nothing measures a rendered row, so the
theme may restyle a row but may not resize one. That constraint, and the `scroll-behavior: smooth`
this list cannot carry, are written where a theme author reads them:
[`canton-theme/CLAUDE.md`](../canton-theme/CLAUDE.md).

Two things are deliberately not modelled: a root font size swapped at runtime without a resize
event, and RTL or horizontal windowing.

Replace rather than extend when the list needs rows of differing height, sticky group headers, or
windowing in both axes. Each of those turns one multiplication into per-row bookkeeping, which is a
library's job and not something to graft onto this hook; `@tanstack/react-virtual` is the swap. It
stays contained because the anatomy is the contract: `TokenList` keeps its parts, its roving tab stop
and its keys, `useVirtualRows` and `useRemPx` go, `ROW_HEIGHT_REM` becomes an estimate rather than
the truth, and `stubViewport` in `src/testing/viewport.ts` is needed either way, since jsdom lays
nothing out for a windowed list of any provenance to measure.

## The favourites row does not answer to the query

`TokenFavorites` renders whatever `favoriteIds` resolves to and never filters. The row is the
consumer's shortcut, fixed for the dialog, not a slice of the list the field is searching; filtering
it would empty it on the first keystroke of a search for anything else. The cost is that
`TokenList`'s "No tokens found" and the live region that announces it describe the list only, so a
needle matching nothing leaves that message under a row of chips that are still there and still
selectable. Accepted while favourites are a handful the consumer names. Filter the row, or hide it
while the needle is non-empty, if it ever becomes user-editable.

A handful is enforced rather than assumed: `MAX_FAVORITES` truncates the resolved list at L2. The
number is arbitrary and human-picked, which is the point — the row wraps and does not scroll, so
without a cap its height is the consumer's to set and the card has no scroll of its own to catch
the spill.

## Where a token's identity and its balance come from

The list is the consumer's, and the kit reads no ledger. What that costs and buys:

- **A token is identified by its `instrumentId`**, the admin party plus the id that registry gave
  it, because nothing on Canton is a global address and two registries can both issue a `USDC`.
  Nothing takes one string for a token, so `tokenKey` is what makes a map key, a React key or an
  equality check out of the pair. Compare keys, never symbols.
- **`balance` sits on the token, beside the metadata.** A party's holdings are private to the
  participant hosting it, so only a read through the connected wallet can supply them: `useHoldings`
  on the `/connect` sub-path is that read, and `sumHoldings` groups its one-per-contract answer into
  one row per instrument. An absent balance means the read has not reached, not that the party holds
  nothing, so the row shows no figure and sorts below every one that has a figure.
- **Metadata comes from the registry, over plain HTTP.** `readInstruments` reads a registry's
  catalogue and stamps its admin party, taken from that registry's own `/info`, onto every id: the
  instrument list carries bare ids, and an id identifies a token only together with the party that
  issued it. It serves no logo, so artwork stays the app's or a curated list's. No session, so it
  sits on the main barrel beside `sumHoldings`.
- **The read lives here rather than in `canton-connect`**, even though it needs that package's
  session. What it knows is the token standard — an interface id, the shape of a holding view, an
  instrument id — and `canton-connect` is a layer over the wallet SDK, kept thin enough to delete.
  Putting it there duplicated `InstrumentId` across two published packages and split one operation
  in half, because the exact-decimal summing is here and that package cannot import it.
  `useLedger` is the documented escape hatch for a read like this, and this is what it is for.
- **`balance` is what the party can spend, and `locked` is the rest.** Not the total, because
  `balance` is also what `<TokenInput>`'s Max fills and what it validates against, so a total would
  have Max offer coin the ledger then refuses. The row shows locked as a second, quieter figure
  under the first, and both reach the row's accessible name: the lock icon is `aria-hidden` and says
  nothing on its own. Nothing locked and no read at all are one case — `getLockedFigure` drops both,
  rather than putting a `0` on every row.
- **`TokenListProvider` owns the order**, balance first and then the order given, so the field, the
  list and the favourites cannot disagree about which token leads. A query re-ranks on top of that,
  by match kind, in `filterTokens`.
- **A token the metadata missed still renders.** Fill `name` and `symbol` from the raw instrument id
  in the list source rather than leaving them out: the row, the chip and the logo's initials all
  need them, and a holding that renders as nothing is worse than one that renders as its id.

## What `<TokenInput>` does not take

Three props a token field usually has are deliberately absent. **Precision** is not configurable
because on Canton it is not a token property: Daml `Decimal` is `Numeric 10` for every instrument,
so there is no ERC-20-style `decimals` to read and `DEFAULT_PRECISION` is the whole answer. The
**ceiling** is `balance` rather than a separate `max`, because `balance` is what Max fills — a cap
that differed from it would make the button lie. And there is no **floor**: a minimum is a rule
about what a particular form will accept, not about what the field can express, so it stays with
the form that has it. Each of the three stays addable later without a break.

## Styling hooks

- **Parts** are semantic classes: `.cnc-<component>*`, BEM `__` for sub-parts (e.g.
  `.cnc-identifier`, `.cnc-identifier__copy`).
- **State** is a `data-*` on the element the theme styles, written from the same value as the
  `aria-*` the component exposes to assistive tech, so the two cannot disagree.
- **Zero styling has two functional exceptions, both load-bearing.** Visually hiding a live region
  is one: a consumer running the kit with no CSS would otherwise get "Copied party id" in their
  layout. So a component applies that `sr-only` inline from `SR_ONLY` in `src/utils/srOnly.ts`, the
  way Radix's `VisuallyHidden` does. The part class stays in the anatomy as a hook. The token row's
  height is the other, because the windowing maths is computed from it; see the windowing section
  above. Nothing else is styled in L2.
- Tokens are `var(--cnc-*)` with no fallback, declared once in `tokens.css`; the whole theme package
  is under `@layer cnc` so consumer CSS wins.
- Token naming convention and dark mode live in
  [`canton-theme/CLAUDE.md`](../canton-theme/CLAUDE.md).

## Theme runtime

`<ThemeProvider>` is the one runtime export that touches the L3 seam, and it touches it at exactly
one point: it writes `light` or `dark` to `data-theme` on `<html>`, which is the attribute the theme
keys its dark values on. It reads no token names and ships no CSS, so a consumer swapping the theme
out keeps the runtime.

The attribute is the contract, so a consumer can also drive it themselves and skip the provider.

The write happens in a layout effect, so the tree the provider wraps never paints in the wrong theme.
What still flashes is the page background, painted before the bundle runs. Closing that needs either a
script in `<head>` ahead of the bundle, which makes the consumer carry a pasted string, a build
plugin, or a server render, or a `prefers-color-scheme` fallback in L3 under
`html:not([data-theme])`, which [`canton-theme/CLAUDE.md`](../canton-theme/CLAUDE.md) neither forbids
nor rules on: it bans the media query *alone*, and a fallback stops matching the moment the provider
writes the attribute. Neither is built; the flash is accepted.

Anything but `light` or `dark` in storage means system, so a cleared or corrupt store degrades to the
OS preference rather than to a hardcoded mode.

Mode lives in React state rather than in the attribute, because `system` is not a value the attribute
can hold: it resolves to one of the other two and has to keep following `matchMedia`.

The provider is client-only. It reads the OS preference to pick its initial state, so a server render
throws rather than guessing a mode the client would then hydrate away from.

## Build & packaging

- **tsdown** builds ESM + `.d.ts` to `dist/`. Components import no CSS, so there is no CSS in the
  build — styling is the theme package's job.
- `sideEffects: false` — safe because no module has a side-effect import. (This is why the fused
  `import './X.css'` model was dropped: side-effect CSS imports and `sideEffects: false` are
  incompatible.) The theme package instead declares `sideEffects: ["**/*.css"]` so a consumer's
  `import '@bootnodedev/canton-theme/default.css'` survives tree-shaking.
- `exports` carries a `development` condition → `src` for live dev; `dist` is used for production.
  Stripping that condition before publish is enforced by `prepublishOnly` (publish hygiene is a
  separate future issue).

## Deferred (not this package's concern yet)

Open Props + Lightning CSS theme toolchain (tokens are hand-authored `--cnc-*` for now; aliasing
Open Props behind them later is non-breaking), the browser + axe test matrix, and publish hygiene.
