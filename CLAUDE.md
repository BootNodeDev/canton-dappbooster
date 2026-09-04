<!-- starter-kit: v2026.09 -->

# Agent Configuration — Canton dAppBooster

This file is the canonical monorepo-wide agent configuration. `AGENTS.md`
files are compatibility shims that point here or to a sibling `CLAUDE.md`.
Each subproject can layer its own `CLAUDE.md` for stack-specific deltas:

- [`canton-connect/CLAUDE.md`](canton-connect/CLAUDE.md) — wagmi-style React hooks for Canton dApps
- [`canton-dappbooster/CLAUDE.md`](canton-dappbooster/CLAUDE.md) — L2 component authoring and file layout
- [`canton-theme/CLAUDE.md`](canton-theme/CLAUDE.md) — L3 `--cnc-*` token naming convention
- [`dapp/frontend/CLAUDE.md`](dapp/frontend/CLAUDE.md) — app layout and naming deltas; its seams are in [`dapp/frontend/architecture.md`](dapp/frontend/architecture.md)
- `dapp/daml/` — see its `README.md`

The dApp connects through any CIP-0103 browser wallet; no wallet lives in this monorepo. This stack
was developed against Carpincho, which has its own repository at
[github.com/BootNodeDev/carpincho-wallet](https://github.com/BootNodeDev/carpincho-wallet).

For the system shape (data flow, components, ports), see [`architecture.md`](architecture.md).

---

## Documentation Distribution

Use one reader per doc type, layered by scope:

| File | Reader / question | Distribution rule |
|------|-------------------|-------------------|
| `README.md` | Human: what is this and how do I run it? | Every independently buildable, runnable, publishable, or testable unit gets one. Subproject READMEs cover only that unit and link to the root README for shared setup. |
| `CLAUDE.md` | Agent: what local rules change how I edit here? | Root always. Subproject only when local conventions differ from root enough that an agent editing only that directory would get it wrong. Deltas only; link upward for repo-wide rules. |
| `AGENTS.md` | Agent compatibility loader | Three-line shim beside every `CLAUDE.md`, pointing to the sibling `CLAUDE.md`. It is never canonical. |
| `architecture.md` | Human or agent: what are the structural seams and internal subsystems? | Root always for cross-component seams. Subproject only when internals outgrow the README: three or more interacting subsystems, non-trivial control flow, or named abstractions. |
| `architecture/<topic>.md` | Human or agent editing one subsystem: how does it behave in full? | Only beside an `architecture.md` that indexes it, when a section outgrows the seam it describes. The index keeps the seam and links the chapter; no chapter without its index entry. |
| Generated reference | Human: what does this export do and how do I call it? | Not hand-maintained and not a file anyone edits. `typedoc.json` builds it from the JSDoc on `canton-dappbooster` and `canton-connect`'s barrels; `@internal` keeps a symbol off it. Fix the doc block, never the site. `canton-connect/coming-from-wagmi.md`, published through `projectDocuments`, is the one hand-written page in it: an exception for a mapping to another library's API, not a pattern to repeat. |

Current distribution:

| Scope | README | AGENTS | CLAUDE | architecture | Decision |
|-------|--------|--------|--------|--------------|----------|
| root | yes | shim | yes | yes | Canonical repo rules and cross-component seams. |
| `canton-connect/` | yes | shim | yes | yes, plus `architecture/` | Public hook API, the machine-owned lifecycle, the picker/adapter seams; chapters for the connection machine and the popup close guard. |
| `dapp/frontend/` | yes | shim | yes | yes | Canton Coin vesting dApp; `CLAUDE.md` carries the page-owns-its-components layout and the naming rules an agent would otherwise get wrong, architecture.md its internal seams. Carries a `PROVENANCE.md` recording the vendored source. |
| `dapp/daml/` | yes | no | no | no | Single DAML package (`amulet-vesting`), vendored source, built here. Carries a `PROVENANCE.md` recording the source commit and the two integration deltas. |
| `canton-dappbooster/` | yes | shim | yes | yes | L2 headless components; `CLAUDE.md` carries the folder-per-component layout an agent would otherwise get wrong, architecture.md the authoring seam (anatomy contract, L2/L3 split, Zag boundary). |
| `canton-theme/` | yes | shim | yes | no | Plain-CSS theme (L3); README covers the two CSS exports, `CLAUDE.md` the `--cnc-*` naming convention an agent adding a token would otherwise invent. |

Subproject docs must not restate root rules. They should describe only their local delta and link upward.

**Reference material never goes in a README.** A README answers "what is this and how do I run it".
Enumerations belong elsewhere however short they are: token lists, prop tables, exported-symbol
indexes, config keys.

- When the code *is* the list — a token file, a type, a barrel — the code is the doc. Group it with
  category comments; a prose copy drifts within two PRs.
- A rule constraining how to author the code goes in the nearest `CLAUDE.md`.
- A seam between units goes in `architecture.md`.

A README may state that a contract exists and link to it. It may not restate it.

## Stack & Conventions (monorepo)

| Category | Technology | Notes |
|----------|-----------|-------|
| Languages | TypeScript, DAML, Bash | TypeScript across the JS subprojects; DAML in `dapp/daml/`; Bash and Node for the root `scripts/` |
| Package manager | pnpm workspaces | Single root `pnpm-lock.yaml`; one root `pnpm install` links every workspace. Workspace layout + overrides live in `pnpm-workspace.yaml`. Root `package.json` orchestrates scripts via `pnpm -C <dir>` |
| Node | 24 | Exact version pinned via root `.nvmrc`; inherits to every Node subproject. Root and the four Node subprojects all declare `engines.node` at `>=24.15.0`, which is what jsdom 30 requires |
| Container runtime | Docker | Required by the `@bootnodedev/canton-barebones` LocalNet; nothing in this repository builds an image |
| LocalNet | @bootnodedev/canton-barebones | Pinned exact in root devDependencies and reached through `pnpm exec canton-barebones`, so the version is the one in `package.json`. Nothing about its config is committed: `scripts/localnet-config.mjs` scaffolds the gitignored `.canton-localnet/` from the tool's own template and turns on `validators.appUser.ui` and `sv.scanUI`, without which nginx serves no `/api/validator` or `/api/scan`. The Splice checkout and the runtime env land in `.canton-localnet/.generated/` |
| Commit linting | commitlint + husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config. `pnpm lint` = `biome check --error-on-warnings` (warnings fail); standalone SVG assets are excluded |
| Pre-commit | lint-staged | Two passes from `.husky/pre-commit`, because only the first writes: `.lintstagedrc.format.mjs` runs root Biome (`biome check --write`) across `canton-connect/`, `canton-dappbooster/`, `canton-theme/`, `dapp/frontend/` and `scripts/`, then `.lintstagedrc.mjs` runs the read-only gates — the tests, the doc check and the anatomy check — concurrently. One pass would let a reformat land mid-parse |
| Pre-push | tsc | Root `.husky/pre-push` runs `pnpm typecheck` (`pnpm -r run --if-present typecheck`, i.e. `tsc` in each Node subproject that defines it) |
| Secret scanning | gitleaks | Shared `.husky/gitleaks.sh` runs gitleaks in the pre-commit (staged diff) and pre-push (outgoing range) hooks; the pinned version (`.gitleaks-version`) is installed by `scripts/install-gitleaks.sh`, so local and CI use the same rules. Accepted non-secret findings live in `.gitleaksignore` |
| Dead code | knip | Root `knip.json` + `pnpm knip`; gates unused files/dependencies/exports. `@canton-network/*` ignored |
| Doc reference + gate | typedoc | Root `typedoc.json` over `canton-dappbooster` and `canton-connect`, each declaring its entry points in its own `typedoc.json` and extending `typedoc.shared.json` for every option that resolves per package. `pnpm docs:check` validates without emitting; `pnpm docs:build` writes the site to `typedoc/`. One config for both, strict: every validation on, `treatValidationWarningsAsErrors` and `treatWarningsAsErrors` |
| Doc rules gate | `scripts/docs-check.mjs` | `pnpm docs:check` runs it after typedoc. Owns what typedoc cannot see: barrel completeness, `@example` presence and naming by tier, snippet compilation, comment width, tier caps, `@category` values, the `@throws` and anatomy-`@see` requirements, the `@param`/`@returns` refusals, and description presence on exported functions (see the splits below) |
| Anatomy parity gate | `scripts/check-anatomy.mjs` | `pnpm check:anatomy` checks every class and `data-*` selector in `canton-theme` against the `anatomy.parts.*` / `anatomy.states.*` strings in `canton-dappbooster`, and requires each anatomy to be reached by at least one selector. Asymmetric on purpose, for the reason its header gives: an unstyled part is a legitimate consumer hook, so there is no per-part check the other way. `aria-*` states are outside it. A styling gate, not a doc one |
| Reference site | Vercel | Project `docs.canton-dappbooster` under the BootNode team, production branch `main`, built by the git integration from `pnpm docs:build`. Its root directory is the repo root, so the root `vercel.json` is its build settings and nobody else's |
| Demo deployment | Vercel | Project `demo.canton-dappbooster` under the same team, root directory `dapp/frontend`, so it reads `dapp/frontend/vercel.json`. A project resolves `vercel.json` relative to its own root directory, which is what keeps the two from colliding. `sourceFilesOutsideRootDirectory` is on and the build command runs from the workspace root, because a production build resolves both libraries to their `dist` rather than their source. Git-connected, production branch `main`, so a merge deploys and a branch gets a preview. `dapp/frontend/api/` ships alongside the bundle as Vercel functions; the SPA catch-all in `vercel.json` is scoped away from `/api/` so it cannot answer one with `index.html` |
| CI | GitHub Actions | `.github/workflows/pr.yml` gate on every PR (biome, typecheck+build+knip+docs, test, commitlint, gitleaks). `main` is protected: 1 approval + all checks green. `add-to-project` and `pr-assign` automate the board and PR assignee |
| Dependency updates | Renovate | `renovate.json`: non-major updates batched weekly, no auto-merge; the `@canton-network/*` SDK graph is held for manual approval on the Dependency Dashboard |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`dapp/daml/`](dapp/daml/) | `amulet-vesting` DAML model: factory, proposal, contract, residual claim, escrowing Canton Coin as a Splice `LockedAmulet`. Vendored from [cc-vesting-contracts](https://github.com/BootNodeDev/cc-vesting-contracts), where its scenarios stay | DAML | n/a (DAR artifact) |
| [`dapp/frontend/`](dapp/frontend/) | Canton Coin vesting dApp over the local participant. Every read and write goes through the connected CIP-0103 wallet via `canton-connect`; the operator's factory, the `AmuletRules` and the open mining round all arrive by explicit disclosure. Imported from `cn-dappbooster@feat/vesting-lite` (see its `PROVENANCE.md`). | Vite + React + Tailwind v4 + zustand + react-router + Biome | 3012 |
| [`canton-connect/`](canton-connect/) | wagmi-style React hooks wrapping the `dapp-sdk` facade; the SDK owns discovery, the picker, the session and the transports | TypeScript + React 19 + xstate 5 + Biome | n/a (library) |
| [`canton-dappbooster/`](canton-dappbooster/) | L2 headless UI components for Canton dApps (tsdown-built, zero styling), plus the light/dark/system theme runtime that drives `data-theme`, plus the pure utilities the components are built on, the exact-decimal amount ones included. Styling lives in `canton-theme`. `src/index.ts` is the public API; `src/connect.ts` is the `/connect` sub-path, holding the components that read the wallet session so the main barrel stays free of the Canton SDK. | TypeScript + React 19 + tsdown + vitest + Biome | n/a (library) |
| [`canton-theme/`](canton-theme/) | L3 plain-CSS theme for the kit: `--cnc-*` tokens + prestyled defaults, consumed by importing its CSS. | CSS | n/a (library) |

Two things the loop needs are not subprojects but dependencies. wallet-service ships from
[BootNodeDev/canton-wallet-service](https://github.com/BootNodeDev/canton-wallet-service),
arrives as a git dependency pinned to a tag, and `scripts/dev-stack.sh` runs it on
port 3010 through `pnpm exec canton-wallet-service`. The LocalNet ships from
[BootNodeDev/canton-barebones](https://github.com/BootNodeDev/canton-barebones), is a pinned
devDependency whose config `scripts/dev-stack.sh` scaffolds into the gitignored
`.canton-localnet/` and drives there over `pnpm exec`.

## Code Style

- All source code in English regardless of conversation language.
- TypeScript preferred over JavaScript across Node subprojects.
- **No semicolons** in TypeScript / JavaScript across the repo.
- **Comments are terse and explain *why*, not *what*.** One sentence, wrapped to the line width.
  Two only if one genuinely cannot carry it; never more. Do not restate what the code already says
  or narrate steps. If the code needs a paragraph to be understood, simplify the code instead.
- **Never annotate members one by one.** No per-property comments on a type, interface, enum, or
  object literal. A member whose name and type do not explain it gets renamed or retyped, not
  captioned. A section header grouping a block of tokens or exports is not a member comment and
  stays allowed.
- **CSS carries no comments at all, with one exception: a section separator** naming the block that
  follows (`/* Account popover */`, `/* Token chips */`, `/* Colour roles */`). Nothing else, not
  even the why-exception below: a stylesheet workaround or ordering constraint is recorded in the
  nearest `CLAUDE.md`, where the next author looks before editing, and not in a comment they will
  delete.
- Outside CSS, the only exception is something the code cannot carry: a hack, a workaround, a
  non-obvious external constraint (browser bug, protocol quirk, load-bearing ordering), a deliberate
  *omission*, or a rejected alternative. Comment that, one line, on the line it applies to. Before
  deleting a comment, check the code still carries the fact — an absence and a road not taken never
  do.
- JSDoc is exempt from the line cap but not from terseness: say what the symbol does, and when a
  caller could reasonably pick a different export, say which. Never restate the type, never
  inventory the fields. Every JSDoc block carries at least one `@example` showing real usage.
- Lint and formatting are centralized in the root `biome.json`. Add project-specific rules under `overrides` keyed by path; do not create per-subproject Biome configs.

## File & Folder Organization

Applies to every TypeScript subproject. Biome (`biome.json`) enforces the allowed casings, the `use`
prefix inside any `src/hooks/`, one-export-per-file naming inside any `src/icons/`, extensionless
imports, the alias-only import rule below, and the `testing/` boundary. Which of the allowed casings
a given file takes is convention:
a linter reads basenames, so it cannot tell a component from a multi-export collection, and folder
casing it cannot see at all.

| Kind | Casing | Example |
|------|--------|---------|
| React component | PascalCase, matching the export | `Button.tsx`, `CopyIcon.tsx` |
| Class or instantiable module | PascalCase | `LedgerBackend.ts` |
| Hook | camelCase, `use`-prefixed | `useCopyToClipboard.ts` |
| Plain module or helper | camelCase | `truncate.ts`, `format.ts` |
| Multi-export leaf collection | camelCase plural | `icons.tsx`, `hooks.ts` |
| Test | `<sibling>.test.ts(x)`, beside its source | `truncate.test.ts` |

A component's own test keeps the component name (`Identifier.test.tsx`), not the entry filename.

Placement:

- Colocate by default. A module used by one component lives beside it; promote it only when a second
  consumer appears.
- Promoted code goes in a kind folder at the src root (`components/`, `hooks/`, `icons/`,
  `providers/`, `testing/`, `utils/`). Those exist from their first member. `utils/` is the one that
  never rejects a file, so each of its modules is named for what it holds (`partyId.ts`, `cx.ts`),
  never `helpers.ts` or an `index.ts` barrel.
- Components live in `components/`, which is a kind folder like the rest and gets no special case.
  Routed pages are the one thing kept apart, in `pages/`, because the router enters them rather
  than a parent composing them. A page is a consumer like any other, so what only one page renders
  lives beside it.
- A component whose job is to supply context rather than render markup lives in `providers/`, named
  `<Thing>Provider`, so what wraps the tree is one place to look instead of a hunt through feature
  folders.
- A leaf collection (`icons.tsx`, `hooks.ts`) holds same-kind exports beside their one consumer.
  Promoting it to a kind folder splits it into one file per export, named after that export.
- Never a folder wrapping a single module. A one-file component stays a flat file
  (`components/Button.tsx`) and earns a folder only when it outgrows one file.
- A component folder is PascalCase, its entry is `index.tsx`, and its subcomponents are PascalCase
  files beside it.
- `testing/` holds test-only helpers and doubles, never imported from non-test code.
- Every symbol a package exports from its public barrel carries a JSDoc block: what it does, and
  where a caller could reasonably pick a different export, when to reach for it. Do not restate the
  type. How much prose, and whether an `@example` is required at all, follows the tier table under
  Doc blocks below.
- **A module has one legal spelling, and it is never relative.** `./utils/toast` and
  `@/utils/toast` both resolved, so which one landed was down to who or what wrote the file.
  Relative specifiers (`.`, `..`, `./*`, `../*`) are now a Biome error in `dapp/frontend`,
  `canton-dappbooster`, and `canton-connect`, in all four positions: `import … from`,
  `export … from`, `export *`, and dynamic `import()`.
  - The app reaches an intra-`src` module through `@/`, wired in `tsconfig.app.json` and
    `vite.config.ts`. The one suppression in the repo is `vite.config.ts` itself, which defines that
    alias and so cannot use it.
  - A library reaches an internal module through `#src/*`, the Node subpath imports declared in its
    own `package.json`, and `@/` is an error there. Both libraries export `./src/index.ts` under the
    `development` condition, so `dapp/frontend` compiles their source through its own Vite, where
    `@` is the *app's* `src`; a library-internal `@/utils/cx` would resolve into the consumer's tree.
    `#` is bound by spec to the nearest `package.json`, so no consumer alias can capture it.
  - That map is `"#src/*": { "types": [four targets], "default": "./src/*" }` because no single
    target satisfies every resolver: `tsc` needs the extension spelled out and walks the array until
    one resolves, which is how one key covers `.ts`, `.tsx`, and folder entries; rolldown ignores
    the array but resolves the extensionless `default` itself. Keep both conditions in step when
    adding a key.
  - Imports carry no file extension, and tsdown inlines every internal module, so no `#` or `@/`
    specifier reaches `dist`.
- Root `scripts/` is exempt from both rules: plain `.mjs` and Bash, run by `node` and `bash`
  directly, with no bundler and no `imports` map to reach through. Relative specifiers with
  extensions are correct there and lint allows them.

## Doc blocks

The tier decides how much prose a doc block carries and whether it owes an `@example`. Every tier is
derivable from the repo's own naming, which is what makes the floors and the ceilings checkable.

| Tier | Detected by | Prose | Example |
|------|-------------|-------|---------|
| Component | exported function returning `ReactElement` | 2 to 6 lines: what it renders, which neighbour to pick instead, any a11y or state contract it owns | 1 to 2 |
| Hook | `use` prefix | 2 to 4 lines: what it does, when to reach for it over the component that wraps it | 1 |
| Callable util | any other exported function | aim for one sentence, because the example is the spec | 1, input to output |
| Props type | `Props` suffix | one sentence, only where a prop carries a non-obvious contract | optional |
| Result type, status union | `Result` suffix, or a union of string literals | one sentence | none required |
| Config object | reached by the caller passing it in rather than being handed one back | 1 to 3 lines, defaults included | 1 |

`scripts/docs-check.mjs` enforces the example requirement and a ceiling per tier that sits above the
table: 6 prose lines for a component or a callable util, 4 for a hook or a config object, 3 for a
props or result type, and 8 lines inside any one `@example`. The ceilings are deliberately loose —
they catch a block that has become an essay, not one that spent a second sentence well. Whether the
prose restates the type, inventories fields, or is merely long is the review call no check can make.

Which tags a block may carry is decided the same way, so that two authors write the same block:

| Tag | Owed by | Refused on |
|-----|---------|------------|
| `@category` | every barrel export, from that package's `categoryOrder` and nothing else | n/a |
| `@example` | whatever the tier table asks for | a third one; a fourth is never the fix |
| `@throws` | any hook or callable util that throws, saying what triggers it | n/a |
| `@see` | a component whose folder holds an `anatomy.ts` | n/a |
| `@param` | never required: one sentence plus a compiled example is the spec | a callable that takes no parameters |
| `@returns` | never required | a hook, whose result type is the contract; any callable whose return type is itself an export |

- **`typedoc.shared.json` holds every option that resolves *per package*, and both packages extend
  it.** `blockTags`, `modifierTags`, `inlineTags` and `sourceLinkTemplate` all behave like
  `categoryOrder` under `entryPointStrategy: "packages"`: set at the root they are accepted and
  silently ignored, which reads as the option not working. Adding a tag is a decision about every
  block in the repo, so it is a review conversation and not a free choice.
- **`sourceLinkTemplate` looks redundant and is load-bearing.** It is character-for-character what
  typedoc builds by itself, so deleting it changes no link. What it also does is skip the
  `git remote get-url origin` call typedoc otherwise makes to learn the repo address for every
  "Defined in" link. Vercel's checkout leaves no `origin`, so that call fails there, and the warning
  it logs fails the whole build under `treatWarningsAsErrors`. A local run cannot see any of this:
  the remote resolves, so the warning never fires and both templates emit the same URL. Force it
  with `typedoc --gitRemote nope`.
- **Typedoc owns that list, and `treatWarningsAsErrors` is what makes it bite.** An off-list tag is
  a comment-parsing warning, which `treatValidationWarningsAsErrors` does not cover, so without it
  an invented `@precondition` renders as prose and no gate objects.
- **`@internal` is how a symbol stays out of the public reference.** Something deliberately not
  public carries it, is still documented in source, and never reaches the site. Nothing is promoted
  to the public barrel just so it can be documented.
- **A change that invalidates a doc block, a README, or an `architecture.md` seam updates it in the
  same commit.** A doc corrected one PR later was wrong in `main` for as long as that took.
- Description presence is split between the two gates: typedoc owns interfaces, type aliases,
  classes, enums and plain variables, `docs-check.mjs` owns exported functions. Not a preference —
  typedoc reaches a function only through its call signature, and asking it to check those also makes
  it demand a caption on every function-typed interface member, which the rule against annotating
  members one by one forbids.
- Every `@example` is compiled. Each package carries a root `doc-fixtures.d.ts` declaring the
  placeholder vocabulary examples may lean on, and an example may use only what that file declares.
- A throw is the callable's contract wherever inside it the `throw` sits, so the check descends into
  nested closures and follows one hop through a `#src/*` import: every canton-connect hook throws
  through `useCantonConnectContext`, and `getExplorerLink` through a module-level guard. It stops at
  one hop, and at a throw the function's own `catch` swallows — `useCopyToClipboard` returns that
  failure as a value and owes no `@throws`.

## The generated reference

Its shape was chosen by reading wagmi, Mantine and TanStack Query rather than invented, because a
reader arrives with habits from those. All three group the sidebar by *what a symbol is*, make every
leaf something you call or render, and keep parameter and return types inside that symbol's page.

- **Every barrel export carries an `@category`, and the vocabulary is closed**: `Components`,
  `Hooks`, `Utilities`, plus `Configuration`, `Types` and `Errors` where a package needs them. A new
  name is a decision about the whole reference, so it is a review conversation and not a free
  choice. `docs-check.mjs` errors on an untagged export; untagged, it would fall back into typedoc's
  TypeScript-kind buckets, which is the flat "every interface together" listing the categories exist
  to replace.
- **The tag is `@category`, never `@group`.** Both render the same headings, but `includeGroups`
  also wraps each package's modules in a `Modules` node, while categories nest under the module.
- **A category holds a symbol and its supporting types**, so `Identifier` and `IdentifierProps` sit
  together. That is what `sort: alphabetical-ignoring-documents` is for: typedoc's default sorts by
  kind first, which lists every `*Props` ahead of every component it belongs to.
- **A sub-path that exists for packaging reasons is merged, not filed separately.** `src/connect.ts`
  is a separate entry point because of what it pulls into a consumer's graph, which is no reason
  to file a component away from the others, so it carries `@mergeModuleWith Main`. The tag
  needs a bare `@module` beside it or the comment is not read as a module comment and the merge is
  skipped in silence, with the `unusedMergeModuleWith` validation not catching it either. Where a
  sub-path is merged, the component's own block states the import path, since the tree no longer
  shows it. `canton-connect`'s `testing` module stays separate: those are doubles, and a fake
  provider listed beside the real one is a trap rather than a convenience.
- **A re-export cannot be tagged.** typedoc resolves it to the upstream declaration, so a local
  `@category` on `export type { PrepareExecuteParams }` is ignored. `defaultCategory` catches those,
  which is safe only because everything with a local declaration is required to be tagged.
- **`categoryOrder`, `defaultCategory`, `categorizeByGroup`, `groupOrder` and `sort` resolve per
  package** under `entryPointStrategy: "packages"`, so they live in each package's own
  `typedoc.json`. At the root they are accepted and silently ignored, which reads as the tag not
  working rather than the option being in the wrong file. Root `typedoc.json` owns entry points,
  validation, and `navigation`.
- **A link in a README or doc block is absolute, or it is not a link.** typedoc copies every
  relative link target into the published site and points the link at the copy, and no option
  disables it. So a relative path silently republishes the file, frozen at build time, and a `.ts`
  target is served as `video/mp2t` and downloads instead of rendering. A file worth reaching from
  the reference gets its full `https://github.com/BootNodeDev/canton-dappbooster/blob/main/…` URL;
  a contributor-infrastructure file nobody reaches from the site is named in backticks and not
  linked. Nothing enforces this, so it is a review check.

## Authoring a Component or Hook

Applies wherever a component or hook is written, app or library alike. Only *styling* differs by
package, because only `canton-dappbooster` splits markup from styles across a package boundary; its
`CLAUDE.md` owns that contract. Nothing below differs.

- Render the element that carries the meaning, and keep the component legal where it is used: one
  rendered inline is a `span`, not a `div`.
- **Every state change a sighted user can see must reach assistive tech too.** Icons are
  `aria-hidden`, so a state carried only by an icon needs a live region or a changing accessible
  name. Two buttons where one looks selected need `aria-pressed`. Never leave this to the consumer.
- Expose that state on the element as `aria-*` or `data-*`, never through a class name alone, so the
  styling hook and the accessibility state stay one source of truth.
- `ref` is an ordinary prop (React 19), so do not reach for `forwardRef`. Do not declare it until a
  consumer needs one: a published prop is a contract owed forever, and adding it later is
  non-breaking.
- **State a component reads from a provider is never also a prop.** `isConnecting` and `partyId`
  on `<ConnectButton>` shadowed the wallet session, so a caller could contradict a connect already
  in flight and the component had to pick a winner. One source, and a consumer wanting other
  behaviour composes the hook the provider already exports. This is what RainbowKit and ConnectKit
  do: no state props, a render-prop that *exposes* the same state if markup must differ.
- **A consumer's handler composes with the component's own action, never replaces it.** Run theirs
  first and treat the built-in as the default action, so `preventDefault` opts out explicitly;
  `onClick ?? doTheThing` silently drops the behaviour the component exists for. Where a state
  machine owns the handler, merge through its own utility (`mergeProps` in Zag) rather than by
  hand, so a handler the library adds later is not missed.
- **A ternary is for a two-way toggle between two things to render; a guard clause is for bailing
  out of the whole render** (loading, error, no data). Two real faces get
  `cond ? <A /> : <B />`; a bail-out gets an `if` above the return.
- Tests assert on roles, accessible names, and whatever contract the component declares. Never on
  styling.

## Working Rules

- Use **pnpm** only (never npm or yarn).
- This is a pnpm workspaces monorepo: one `pnpm install` from the repo root installs and links every package. There is no per-package install step.
- Run a subproject script either by `cd <subproject>` or by using `pnpm -C <subproject> run <script>`. The root `package.json` is the whole local loop, in order: `mint-token`, `build-dar`, `deploy-dar -- <dar>`, `bootstrap`, `app:dev`. Docs and `dev-stack.sh` use those names, not the underlying commands, so the implementation can move without a doc sweep. There is no `format` script anywhere: `lint:fix` is `biome check --write`, which formats too.
- **The LocalNet is not in this repository, and neither is its config.** It is
  `@bootnodedev/canton-barebones`, a pinned devDependency driven with `start` / `stop` / `reset` in
  the directory holding `canton-barebones.config.json`. `up` scaffolds that directory itself through
  `scripts/localnet-config.mjs`, at the gitignored `.canton-localnet/`, so nothing is hand-edited or
  committed; `scripts/dev-stack.sh` shells out to it in the directory given as a path-shaped first
  argument (which also opens the menu, the normal way to drive the stack), else a second argument
  after the subcommand, else `CANTON_LOCALNET_DIR`. The CLI reads its config from its own cwd and
  writes the Splice checkout and the runtime env beside it, under `.generated/`.
- **`scripts/localnet-config.mjs` owns the two flags the stack cannot run without**
  (`validators.appUser.ui`, `sv.scanUI`) and re-scaffolds from the installed template whenever that
  template moves past the local copy — a new config version, which every command would otherwise
  reject, or a new Splice tag, which would otherwise pin the stack to a version the tool was not
  tested against. Anything else set there survives until then, so a standing deviation belongs in a
  directory of its own via `CANTON_LOCALNET_DIR`, not in `.canton-localnet/`.
- `node scripts/add-component.mjs <PascalCaseName>` scaffolds a `canton-dappbooster` component
  folder. Not wired into `package.json`: it is an authoring convenience, not part of the loop above.
- `pnpm run bootstrap` creates the vesting operator and its factory, which the
  dApp cannot start without. Run it after the DAR is deployed. It writes no file: the dApp reads
  both back off the ledger once a wallet connects, so nothing can go stale between the two, and
  pointing the wallet at another participant is the whole of switching networks.
- **One `.env`, at the root.** It is wallet-service's entire configuration, because the service
  loads dotenv from the directory it starts in and `pnpm exec` starts it here; it also holds the
  signing recipe `scripts/mint-token.mjs` reads and the token `scripts/deploy-dar.sh` sends. Both
  scripts resolve `.env` from their own parent directory, which is what moving them into `scripts/`
  repointed, so neither takes a path argument. Minting is offline: no container has to be up. The
  dApp's `VITE_*` variables live there too: `dapp/frontend/vite.config.ts` calls `loadEnv` against
  the repo root with an empty prefix, so it reads every key in that file, `CANTON_AUTH_SECRET`
  included. Only what `parseEnv` returns may reach `define` — never the loaded object.
- **A `pnpm run` alias takes no arguments.** pnpm forwards the `--` separator to the script, so an
  alias over something reading `argv` mints the wrong thing in silence: `pnpm run mint-token --
  ledger-api-user` would sign for subject `-- ledger-api-user`. That is why `mint-token` bakes the
  subject in. `deploy-dar` is the one exception and pays for it with an explicit `[ "$1" = "--" ] &&
  shift`, which is what lets it take `-- <dar>`.
- Local ports are intentionally assigned in the `3010+` range (see table above). Do not change them without updating every subproject's defaults.
- Treat the single root `pnpm-lock.yaml` as authoritative. Do not regenerate it as part of unrelated changes, and do not reintroduce per-package lockfiles.
- The `@canton-network/wallet-sdk` pin left with wallet-service: its own repository holds that exact version, so `pnpm-workspace.yaml` carries no SDK overrides. Its `core-acs-reader` override does **not** travel here — pnpm applies `overrides` only in the root running the install, and it resolves a git dependency's transitives itself rather than reading that dependency's own lock file — so this repo resolves `core-acs-reader` on the SDK's own range and the root lock records 1.18.1, where the extracted repo pins 1.12.0. The loop was verified end to end on 1.18.1. Renovate's `@canton-network/**` hold plus the lock file are what keep it there; re-resolve deliberately, not as a side effect. `canton-connect`'s `@canton-network/*` deps (`dapp-sdk`, `core-types`) live on the ranges in its own `package.json`; bump those directly and test the connect flow. Both its `core-types` and its `dapp-sdk` devDependencies are pinned exact, not caret: Renovate's `@canton-network/**` hold only blocks version PRs, so a caret let lock file maintenance re-resolve the SDK past the hold (PR #79). The peer ranges stay caret so consumers keep a range, which is why the peer says `^1.4.0` while the pinned dev dependency is `1.5.1`.
- Build scripts are gated in `pnpm-workspace.yaml` under `allowBuilds` (`esbuild`/`protobufjs` allowed; `puppeteer` blocked so `@mermaid-js/mermaid-cli` does not download a Chromium). `@bootnodedev/canton-wallet-service` is listed there too, because pnpm refuses to run a git dependency's `prepare` otherwise, and that key is the resolved tarball id — moving the ref means replacing the commit sha in it.
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `pnpm -C`:
  - `dapp/frontend`: `pnpm test` (vitest + jsdom, though it asserts on no DOM: the wallet SDK
    reached through `canton-connect` touches DOM globals on import)
  - `canton-connect`: `pnpm test` (vitest + jsdom)
  - `canton-dappbooster`: `pnpm test` (vitest + jsdom + Testing Library)
  - root `scripts/`: covered by the root `pnpm test`, which appends
    `node --test "scripts/*.test.mjs"` to the fan-out because `pnpm -r` skips the root package
- Kit components are tested inside `canton-dappbooster` (vitest + jsdom). `dapp/frontend`'s vitest run covers its pure logic wherever that lives; component/DOM behaviour and app+kit integration are out of scope there.
- From the root, `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm knip` fan out across every workspace (`pnpm -r --if-present`). CI runs these minus `dapp/daml`'s build, which needs `dpm` and a network fetch of the Splice DARs.
- `pnpm docs:check` (typedoc plus `scripts/docs-check.mjs`) and `pnpm run check:anatomy` do not fan out: both read the two library packages directly, and typedoc has one config over both. `pnpm docs:build` writes the reference site to `typedoc/`.
- Cover the paths that matter — business logic, API integrations, component behaviour. Skip styling, third-party library internals, trivial getters/setters.

## Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/).

**Format:** `type(scope): subject`

- **Scope** is optional: `feat: add login` and `feat(auth): add login` are both valid.
- **Subject** uses imperative mood, lowercase after the colon, no trailing period.
- **Body** (optional) is separated by a blank line and explains *what* and *why*.

**Allowed prefixes** (enforced by [`commitlint.config.js`](commitlint.config.js)):

| Prefix | Purpose |
|--------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, dependencies, config |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace, semicolons |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |
| `build` | Build system or external dependencies |
| `revert` | Reverts a previous commit |
| `wip` | Work in progress (avoid on main) |
| `release` | Release-related changes |
| `hotfix` | Emergency fix bypassing normal flow |

## PR Workflow

- Every PR must reference an issue (`Closes #N`).

  > No related issue? Use `No related issue.` as the first line of the Summary section.

- Mirror the issue's acceptance criteria in the PR.
- Self-review your diff before requesting peer review.
- Keep PRs small and focused — one issue, one PR.
- PR titles use the same Conventional Commit format (`feat: add user dashboard`).
- The `create-pr` skill at `.claude/skills/create-pr/` reads [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) and fills every section automatically.

## Label Conventions

GitHub form dropdowns (like the Priority field in issue templates) only work through the web UI. When issues are created via `gh` CLI or REST API, dropdown values become unstructured body text — not queryable, not consistent. **Labels are the API-reliable mechanism for structured metadata.**

**Priority** (bugs, features, and epics):

| Label | Description |
|-------|-------------|
| `priority: critical` | Blocking work, system down, or security issue |
| `priority: high` | Must be addressed in current sprint |
| `priority: medium` | Should be addressed soon |
| `priority: low` | Nice to have, can wait |

Labels are queryable: `gh issue list --label "priority: high"`.

The `create-issue` skill at `.claude/skills/create-issue/` applies these labels automatically when creating issues via CLI.

## Guardrails

- Do not commit secrets, API keys, or credentials. `.env.local` files are gitignored — keep it that way.
- Do not modify CI/CD pipelines without team review.
- Do not skip tests or linting to make a build pass.
- Do not bypass the husky hooks (`--no-verify`) unless the user explicitly asks.
- **Never touch the root `README.md` unless explicitly told to in that request.** No
  doc-sync sweep, no "update docs in the same commit" rule and no `update-docs` run
  authorizes editing it. Subproject READMEs are not covered by this.
- When in doubt, ask — don't assume.

## Change Strategy

- Prefer small, focused diffs over broad refactors.
- Preserve existing UX unless the task explicitly changes it.
- Avoid introducing new patterns when a project pattern already exists.
- Update docs only when behaviour or workflow changes.

## Validation Checklist

Before declaring monorepo-touching work done:

- Subproject-level: `pnpm run lint` and `pnpm test` inside any subproject you touched.
- Root-level: reproduce the CI `pr` gate locally with `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm knip`, `pnpm docs:check`, `pnpm run check:anatomy`.
- `git push --dry-run` exercises the pre-push hook (`pnpm typecheck` + gitleaks scan of the outgoing range).
- Every PR must pass the `.github/workflows/pr.yml` gate and one approval before `main` accepts it.
- For the full end-to-end loop (LocalNet up → wallet-service → DAR built → DAR deployed → bootstrap → wallet → dApp), follow [`README.md`](README.md).

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 Canton wallet provider spec](https://github.com/digital-asset/canton/tree/main/community/app/src/pack/examples/04-canton-wallet)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
