<!-- starter-kit: v2026.09 -->

# Agent configuration for Canton dAppBooster

This file is the canonical monorepo-wide agent configuration. `AGENTS.md`
files are compatibility shims that point here or to a sibling `CLAUDE.md`.
Each subproject can layer its own `CLAUDE.md` for stack-specific deltas:

- [`canton-connect/CLAUDE.md`](canton-connect/CLAUDE.md): wagmi-style React hooks for Canton dApps
- [`canton-create/CLAUDE.md`](canton-create/CLAUDE.md): the `create-canton-dappbooster` installer, its flag rule, its scaffold rules and its demo recording. How a run works is in [`canton-create/architecture.md`](canton-create/architecture.md)
- [`canton-dappbooster/CLAUDE.md`](canton-dappbooster/CLAUDE.md): L2 component authoring and file layout
- [`canton-theme/CLAUDE.md`](canton-theme/CLAUDE.md): the L3 `--cnc-*` token naming convention
- [`example-dapps/amulet-vesting/CLAUDE.md`](example-dapps/amulet-vesting/CLAUDE.md): the vesting example's layout and naming deltas. Its seams are in [`example-dapps/amulet-vesting/architecture.md`](example-dapps/amulet-vesting/architecture.md), and its Daml in `daml/README.md`

The dApp connects through any CIP-0103 wallet; no wallet lives in this monorepo.

For the system shape (data flow, components, ports), see [`architecture.md`](architecture.md).

---

## Documentation distribution

Use one reader per doc type, layered by scope:

| File | Reader / question | Distribution rule |
|------|-------------------|-------------------|
| `README.md` | Human: what is this and how does someone run it? | Every unit that builds, runs, publishes or tests on its own gets one. A subproject's README covers only that unit and links to the root README for shared setup. |
| `CLAUDE.md` | Agent: what local rules change how an agent edits here? | Root always. Subproject only when local conventions differ from root enough that an agent editing only that directory would get it wrong. Deltas only; link upward for repo-wide rules. |
| `AGENTS.md` | Agent compatibility loader | Three-line shim beside every `CLAUDE.md`, pointing to the sibling `CLAUDE.md`. It is never canonical. |
| `architecture.md` | Human or agent: what are the structural seams and internal subsystems? | Root always for cross-component seams. Subproject only when internals outgrow the README: three or more interacting subsystems, control flow that takes explaining, or named abstractions. |
| `architecture/<topic>.md` | Human or agent editing one subsystem: how does it behave in full? | Only beside an `architecture.md` that indexes it, when a section outgrows the seam it describes. The index keeps the seam and links the page; no page without its index entry. |
| Generated reference | Human: what does this export do and how does someone call it? | Not hand-maintained and not a file anyone edits. `kit/typedoc.json` builds it from the JSDoc on the barrels of `canton-dappbooster` and `canton-connect`, and `@internal` keeps a symbol off it. Fix the doc block, never the site. `canton-connect/coming-from-wagmi.md`, published through `projectDocuments`, is the one hand-written page in it: an exception for a mapping to another library's API, not a pattern to repeat. |

Current distribution:

| Scope | README | AGENTS | CLAUDE | architecture | Decision |
|-------|--------|--------|--------|--------------|----------|
| root | yes | shim | yes | yes | Canonical repo rules and cross-component seams. |
| `canton-connect/` | yes | shim | yes | yes, plus `architecture/` | Public hook API, the machine-owned lifecycle, the picker/adapter seams; pages for the connection machine and the popup close guard. |
| `canton-create/` | yes | shim | yes | yes | The `create-canton-dappbooster` installer. `CLAUDE.md` carries the flag rule, the scaffold rules and the demo recording, and `architecture.md` how a run and the scaffold layers fit together. A project reads the `README.md` files in `scaffold/`: `starter/`'s whole, and `daml-tooling/`'s and `localnet/`'s as sections appended to the app's. |
| `example-dapps/amulet-vesting/` | yes | shim | yes | yes | Canton Coin vesting example, published on its own. `CLAUDE.md` carries the page-owns-its-components layout and the naming rules an agent would otherwise get wrong, and architecture.md its internal seams. Its single Daml package (`amulet-vesting`) sits in `daml/` with a `README.md` of its own. `PROVENANCE.md` and `daml/PROVENANCE.md` record the vendored sources. |
| `canton-dappbooster/` | yes | shim | yes | yes | L2 headless components; `CLAUDE.md` carries the folder-per-component layout an agent would otherwise get wrong, architecture.md the authoring seam (anatomy contract, L2/L3 split, Zag boundary). |
| `canton-theme/` | yes | shim | yes | no | Plain-CSS theme (L3); README covers the two CSS exports, `CLAUDE.md` the `--cnc-*` naming convention an agent adding a token would otherwise invent. |

Subproject docs must not restate root rules. They should describe only their local delta and link upward.

**Reference material never goes in a README.** A README answers "what is this and how does someone run it".
Enumerations belong elsewhere however short they are: token lists, prop tables, exported-symbol
indexes, config keys.

- When the code *is* the list (a token file, a type, a barrel), the code is the doc. Group it with
  category comments; a prose copy drifts within two PRs.
- A rule constraining how to author the code goes in the nearest `CLAUDE.md`.
- A seam between units goes in `architecture.md`.

A README may state that a contract exists and link to it. It may not restate it.

## Stack and conventions (monorepo)

| Category | Technology | Notes |
|----------|-----------|-------|
| Languages | TypeScript, Daml, Bash | TypeScript across the JS subprojects; Daml in each app's `daml/`; Bash and Node for the root `scripts/` and `kit/` |
| Package manager | pnpm workspaces | Single root `pnpm-lock.yaml`; one root `pnpm install` links every workspace. Workspace layout, `linkWorkspacePackages` and `allowBuilds` live in `pnpm-workspace.yaml`. Root `package.json` orchestrates scripts via `pnpm -C <dir>` |
| Node | 24 | Exact version pinned via root `.nvmrc`; inherits to every Node package. Root, `canton-connect`, `canton-dappbooster` and `example-dapps/amulet-vesting` declare `engines.node` at `>=24.15.0`, which is what `jsdom` 30 requires. `canton-create` declares `>=22.12.0` |
| Container runtime | Docker | Required by the `@bootnodedev/canton-barebones` LocalNet; nothing in this repository builds an image |
| Wallet | `@canton-network/wallet-gateway-remote` | The CIP-0103 wallet the dApp connects to, from the Splice wallet kernel. Pinned exact in the root `devDependencies`, run by `pnpm run wallet-gateway` on port 3030, configured by the committed `wallet-gateway.config.json`. `example-dapps/amulet-vesting` registers it as a `RemoteAdapter` in `additionalAdapters`, which is what lets a session survive a reload |
| LocalNet | `@bootnodedev/canton-barebones` | Pinned exact in the root `devDependencies` and reached through `pnpm exec canton-barebones`, so the version is the one in `package.json`. The repo commits none of its config. `scripts/localnet-config.mjs` scaffolds the gitignored `.canton-localnet/` from the tool's own template and turns on `validators.appUser.ui` and `sv.scanUI`. Without them, nginx serves no `/api/validator` or `/api/scan`. The Splice checkout and the runtime env land in `.canton-localnet/.generated/` |
| Commit linting | commitlint + Husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config. `pnpm lint` = `biome check --error-on-warnings` (warnings fail); it skips standalone SVG assets |
| Pre-commit | lint-staged | Two passes from `.husky/pre-commit`, because only the first writes. `.lintstagedrc.format.mjs` runs root Biome (`biome check --write`) across `canton-connect/`, `canton-create/`, `canton-dappbooster/`, `canton-theme/`, `example-dapps/`, `kit/` and `scripts/`. Then `.lintstagedrc.mjs` runs the read-only gates (the tests, the doc check and the anatomy check) concurrently. One pass would let a reformat land mid-parse |
| Pre-push | `tsc` | Root `.husky/pre-push` runs `pnpm typecheck` (`pnpm -r run --if-present typecheck`, that is `tsc` in each Node subproject that defines it) |
| Secret scanning | gitleaks | Shared `.husky/gitleaks.sh` runs gitleaks in the pre-commit (staged diff) and pre-push (outgoing range) hooks. `scripts/install-gitleaks.sh` installs the pinned version (`.gitleaks-version`), so local and CI use the same rules. Accepted non-secret findings live in `.gitleaksignore` |
| Dead code | knip | Root `knip.json` + `pnpm knip`; gates unused files/dependencies/exports |
| Doc reference + gate | TypeDoc | `kit/typedoc.json` covers `canton-dappbooster` and `canton-connect`. Each declares its entry points in its own `typedoc.json` and extends `kit/typedoc.shared.json` for every option that resolves per package. `pnpm docs:check` validates without emitting; `pnpm docs:build` writes the site to `typedoc/`. One config for both, strict: every validation on, `treatValidationWarningsAsErrors` and `treatWarningsAsErrors` |
| Doc rules gate | `kit/docs-check.mjs` | `pnpm docs:check` runs it after TypeDoc. It owns what TypeDoc cannot see: barrel completeness, `@example` presence and naming by tier, snippet compilation, comment width, tier caps and `@category` values. It also owns the `@throws` and anatomy-`@see` requirements, the `@param`/`@returns` refusals, and description presence on exported functions (see the splits below) |
| Anatomy parity gate | `kit/check-anatomy.mjs` | `pnpm check:anatomy` checks every class and `data-*` selector in `canton-theme` against the `anatomy.parts.*` / `anatomy.states.*` strings in `canton-dappbooster`. It also requires at least one selector to reach each anatomy. It is asymmetric on purpose, for the reason its header gives. A part without styles is a legitimate consumer hook, so there is no per-part check the other way. `aria-*` states are outside it. A styling gate, not a doc one |
| Version lockstep check | `kit/check-versions.mjs` | `pnpm run check:versions` fails unless every declared range pointing at a library is `^<that library folder's version>`. `kit/check-versions.test.mjs` runs the same check inside `pnpm test`, and the PR job calls the script. Given a version argument, it also requires the root and every public package to be on it. That is how the release workflow refuses a tag that disagrees with the manifests |
| Reference site | Vercel | Project `docs.canton-dappbooster` under the BootNode team, production branch `main`, built by the git integration from `pnpm docs:build`. Its root directory is the repo root, so the root `vercel.json` holds its build settings and no other project's |
| Demo deployment | Vercel | Project `demo.canton-dappbooster` under the same team, root directory `example-dapps/amulet-vesting`, so it reads `example-dapps/amulet-vesting/vercel.json`. A project resolves `vercel.json` relative to its own root directory, which is what keeps the two from colliding. `sourceFilesOutsideRootDirectory` is on and the build command runs from the workspace root. A production build needs both, because it resolves both libraries to their `dist` rather than their source. Git-connected, production branch `demo-canton-dappbooster-cc`, so a push there deploys and every other branch gets a preview. The deploy is a static bundle, so `vercel.json` rewrites every path to `index.html` |
| CI | GitHub Actions | `.github/workflows/pr.yml` gate on every PR (Biome, typecheck+build+knip+docs, test, commitlint, gitleaks). Branch protection on `main` requires 1 approval and every check green. `.github/workflows/release.yml` publishes to npm when someone publishes a GitHub release; see Packaging and publishing. `add-to-project` and `pr-assign` automate the board and PR assignee |
| Dependency updates | Renovate | `renovate.json`: non-major updates batched weekly, no auto-merge. Renovate holds the `@canton-network/*` SDK graph for manual approval on the Dependency Dashboard |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`example-dapps/amulet-vesting/`](example-dapps/amulet-vesting/) | Canton Coin vesting dApp, an example `create-canton-dappbooster` scaffolds, published as `@bootnodedev/canton-example-amulet-vesting`. Every read and write goes through the connected CIP-0103 wallet via `canton-connect`; the operator's factory, the `AmuletRules` and the open mining round all arrive by explicit disclosure. Its `amulet-vesting` Daml model in `daml/` covers the factory, the proposal, the contract and the residual claim, and holds Canton Coin in escrow as a Splice `LockedAmulet`. It is vendored from [cc-vesting-contracts](https://github.com/BootNodeDev/cc-vesting-contracts), where its scenarios stay. Imported from `cn-dappbooster@feat/vesting-lite` (see its `PROVENANCE.md`). | Vite + React + Ark UI + lucide-react + Tailwind v4 + `zustand` + react-router + Daml | 3012 |
| [`canton-create/`](canton-create/) | The `create-canton-dappbooster` installer, published on its own. It copies the starter from `scaffold/starter/` or fetches an example from npm. It then adds `scaffold/daml-tooling/` when the app has a contract, and `scaffold/localnet/` when the user asks for a local network. | TypeScript + Ink + React 19 + `tsdown` + `vitest` | n/a (command-line tool) |
| [`canton-connect/`](canton-connect/) | wagmi-style React hooks wrapping the `dapp-sdk` facade; the SDK owns discovery, the picker, the session and the transports | TypeScript + React 19 + `xstate` 5 + Biome | n/a (library) |
| [`canton-dappbooster/`](canton-dappbooster/) | L2 headless UI components for Canton dApps, built with `tsdown` and carrying no styling. It also holds the light/dark/system theme runtime that drives `data-theme`, and the pure utilities the components build on, the exact-decimal amount ones included. Styling lives in `canton-theme`. `src/index.ts` is the public API. `src/connect.ts` is the `/connect` sub-path, holding the components that read the wallet session so the main barrel stays free of the Canton SDK. | TypeScript + React 19 + `tsdown` + `vitest` + Biome | n/a (library) |
| [`canton-theme/`](canton-theme/) | L3 plain-CSS theme for the kit: `--cnc-*` tokens + styled defaults, consumed by importing its CSS. | CSS | n/a (library) |

Two things the loop needs are not subprojects but dependencies. The LocalNet ships from
[`BootNodeDev/canton-barebones`](https://github.com/BootNodeDev/canton-barebones) as a pinned dev
dependency. `scripts/dev-stack.sh` scaffolds its config into the gitignored `.canton-localnet/` and
drives it there over `pnpm exec`. The wallet ships from
[`canton-network/wallet`](https://github.com/canton-network/wallet) as
`@canton-network/wallet-gateway-remote` and installs from npm as a root dev dependency.
`scripts/dev-stack.sh` runs it on port 3030 through `pnpm run wallet-gateway`.

## Code style

- All source code in English regardless of conversation language.
- TypeScript preferred over JavaScript across Node subprojects.
- **No semicolons** in TypeScript / JavaScript across the repo.
- **Name it, do not caption it.** A function, variable or type that a reader cannot follow without a
  comment gets renamed or split instead. The name is the documentation.
- **A comment is only for what the code cannot carry.** That means a hack, a workaround, or an
  outside constraint (browser bug, protocol quirk, an ordering that matters). It also means a
  deliberate *omission* or a rejected alternative. Nothing else gets one.
- **One line, hard cap**, on the line it applies to and not in a block before the function. Needing a
  second line means the code is wrong or the prose belongs in an `.md`.
- **No narration.** Never restate what the code says, walk through steps, or explain how a
  dependency behaves. A file carrying more comment than code is a bad file.
- **Tests document themselves through their names.** A test needing a comment needs a better name.
- **Never annotate members one by one.** No per-property comments on a type, interface, enum, or
  object literal. A member whose name and type do not explain it gets renamed or retyped, not
  captioned. A section header grouping a block of tokens or exports is not a member comment and
  stays allowed.
- **CSS carries no comments at all, with one exception: a section separator** naming the block that
  follows (`/* Account popover */`, `/* Token chips */`, `/* Colour roles */`). Nothing else, not
  even the exception named earlier. Record a style sheet workaround or ordering constraint in the
  nearest `CLAUDE.md`, where the next author looks before editing. A comment there would get
  deleted.
- **Where the prose goes instead**: how a subsystem behaves in the nearest `architecture.md`, a rule
  about how to write the code in the nearest `CLAUDE.md`. Both outlive a comment.
- **Fix a comment in a file you change.** Find one breaking these rules in a file the current task
  already changes, and fix it in the same change. Delete it where the code carries the fact, cut it
  to one line where it does not, or move the prose to the nearest `.md`. Before deleting, check the
  code still carries the fact: an absence and a rejected option never do. In any other file, name it
  in your report and leave it alone; a repo-wide sweep is its own commit.
- JSDoc is exempt from the one-line cap but not from terseness. Say what the symbol does, and when a
  caller could reasonably pick a different export, say which. Never restate the type, never
  inventory the fields. Every JSDoc block carries at least one `@example` showing real usage, and the
  Doc blocks table below caps the rest.
- The root `biome.json` holds lint and formatting. Add project-specific rules under `overrides` keyed by path; do not create per-subproject Biome configs.

## File and folder organization

Applies to every TypeScript subproject. Biome (`biome.json`) enforces the allowed casings, the `use`
prefix inside any `src/hooks/`, and one-export-per-file naming inside any `src/icons/`. It also
enforces imports without an extension, the alias-only import rule below, and the `testing/`
boundary. Which of the allowed casings a given file takes is convention. A linter reads file names,
so it cannot tell a component from a multi-export collection, and folder casing it cannot see at
all.

| Kind | Casing | Example |
|------|--------|---------|
| React component | PascalCase, matching the export | `Button.tsx`, `CopyIcon.tsx` |
| Class, or a module you instantiate | PascalCase | `LedgerBackend.ts` |
| Hook | camelCase, `use`-prefixed | `useCopyToClipboard.ts` |
| Plain module or helper | camelCase | `truncate.ts`, `format.ts` |
| Multi-export leaf collection | camelCase plural | `icons.tsx`, `hooks.ts` |
| Test | `<sibling>.test.ts(x)`, beside its source | `truncate.test.ts` |

A component's own test keeps the component name (`Identifier.test.tsx`), not the entry filename.

Placement:

- Keep a module beside its one consumer by default. Promote it only when a second consumer appears.
- Promoted code goes in a kind folder at the root of `src` (`components/`, `hooks/`, `icons/`,
  `providers/`, `testing/`, `utils/`). Those exist from their first member. `utils/` is the one that
  never rejects a file, so each of its modules takes its name from what it holds (`partyId.ts`,
  `cx.ts`), never `helpers.ts` or an `index.ts` barrel.
- Components live in `components/`, which is a kind folder like the rest and gets no special case.
  Routed pages are the one thing kept apart, in `pages/`, because the router enters them rather
  than a parent composing them. A page is a consumer like any other, so what only one page renders
  lives beside it.
- A component whose job is to supply context rather than render markup lives in `providers/`, named
  `<Thing>Provider`. What wraps the tree is then one place to look instead of a hunt through
  feature folders.
- A leaf collection (`icons.tsx`, `hooks.ts`) holds same-kind exports beside their one consumer.
  Promoting it to a kind folder splits it into one file per export, named after that export.
- Never a folder wrapping a single module. A one-file component stays a flat file
  (`components/Button.tsx`) and earns a folder only when it outgrows one file.
- A component folder is PascalCase, its entry is `index.tsx`, and its child components are
  PascalCase files beside it.
- `testing/` holds test-only helpers and doubles, never imported from non-test code.
- Every symbol a package exports from its public barrel carries a JSDoc block. It says what the
  symbol does, and when to reach for it where a caller could reasonably pick a different export. Do
  not restate the type. How much prose, and whether the block owes an `@example` at all, follows the
  tier table under Doc blocks below.
- **A module has one legal spelling, and it is never relative.** `./utils/toast` and
  `@/utils/toast` both resolved, so which one landed was down to who or what wrote the file.
  Relative specifiers (`.`, `..`, `./*`, `../*`) are now a Biome error in `example-dapps/*`,
  `canton-dappbooster`, and `canton-connect`, in all four positions: `import … from`,
  `export … from`, `export *`, and dynamic `import()`.
  - The app reaches a module inside `src` through `@/`, wired in `tsconfig.app.json` and
    `vite.config.ts`. The one suppression in the repo is `vite.config.ts` itself, which defines that
    alias and so cannot use it.
  - A library reaches an internal module through `#src/*`, the Node sub-path imports declared in
    its own `package.json`, and `@/` is an error there. Both libraries export `./src/index.ts` under
    the `development` condition, so `example-dapps/amulet-vesting` compiles their source through its
    own Vite, where `@` is the *app's* `src`. A library-internal `@/utils/cx` would resolve into the
    consumer's tree. The spec binds `#` to the nearest `package.json`, so no consumer alias can
    capture it.
  - That map is `"#src/*": { "types": [four targets], "default": "./src/*" }` because no single
    target satisfies every resolver. `tsc` needs the extension spelled out and walks the array until
    one resolves, which is how one key covers `.ts`, `.tsx`, and folder entries. `rolldown` ignores
    the array but resolves the `default` without an extension itself. Keep both conditions in step
    when adding a key.
  - Imports carry no file extension, and `tsdown` bundles every internal module into the output, so
    no `#` or `@/` specifier reaches `dist`.
- `kit/` and any `scripts/` folder are exempt from both rules. They hold plain `.mjs` and Bash, run
  by `node` and `bash` directly, with no build step and no `imports` map to reach through. Relative
  specifiers with extensions are correct there and lint allows them, kebab-case filenames included.
  The one exception is `canton-create/scripts/record-demo.ts`, which runs on Bun for the reason in
  `canton-create/CLAUDE.md`.

## Doc blocks

The tier decides how much prose a doc block carries and whether it owes an `@example`. The repo's
own naming determines every tier, which is what makes the floors and the ceilings checkable.

| Tier | Detected by | Prose | Example |
|------|-------------|-------|---------|
| Component | exported function returning `ReactElement` | 2 to 6 lines: what it renders, which neighbour to pick instead, any a11y or state contract it owns | 1 to 2 |
| Hook | `use` prefix | 2 to 4 lines: what it does, when to reach for it over the component that wraps it | 1 |
| Utility function | any other exported function | aim for one sentence, because the example is the spec | 1, input to output |
| Props type | `Props` suffix | one sentence, only where a prop carries a contract that is not obvious | optional |
| Result type, status union | `Result` suffix, or a union of string literals | one sentence | none required |
| Config object | the caller passes it in rather than getting one back | 1 to 3 lines, defaults included | 1 |

`kit/docs-check.mjs` enforces the example requirement, plus a ceiling per tier set higher than the
table:

- 6 prose lines for a component or a utility function
- 4 for a hook or a config object
- 3 for a props or result type
- 8 lines inside any one `@example`

The ceilings are loose on purpose: they catch a block that has become an essay, not one that spent a second sentence well.
Whether the prose restates the type, inventories fields, or is merely long is the review call no
check can make.

The same rules decide which tags a block may carry, so that two authors write the same block:

| Tag | Owed by | Refused on |
|-----|---------|------------|
| `@category` | every barrel export, from that package's `categoryOrder` and nothing else | n/a |
| `@example` | whatever the tier table asks for | a third one; a fourth is never the fix |
| `@throws` | any hook or utility function that throws, saying what triggers it | n/a |
| `@see` | a component whose folder holds an `anatomy.ts` | n/a |
| `@param` | never required: one sentence plus a compiled example is the spec | a function that takes no parameters |
| `@returns` | never required | a hook, whose result type is the contract; any function whose return type is itself an export |

- **`kit/typedoc.shared.json` holds every option that resolves *per package*, and both packages
  extend it.** `blockTags`, `modifierTags`, `inlineTags` and `sourceLinkTemplate` all behave like
  `categoryOrder` under `entryPointStrategy: "packages"`. In `kit/typedoc.json`, TypeDoc accepts
  them and ignores them without a word, which reads as the option not working. Adding a tag is a
  decision about every block in the repo, so it is a review conversation and not a free choice.
- **`sourceLinkTemplate` looks redundant, and the build needs it.** It is character-for-character what
  TypeDoc builds by itself, so deleting it changes no link. It also skips the
  `git remote get-url origin` call TypeDoc otherwise makes to learn the repo address for every
  "Defined in" link. Vercel's checkout leaves no `origin`, so that call fails there, and the warning
  it logs fails the whole build under `treatWarningsAsErrors`. A local run cannot see any of this:
  the remote resolves, so the warning never fires and both templates emit the same URL. Force it
  with `typedoc --gitRemote nope`.
- **TypeDoc owns that list, and `treatWarningsAsErrors` is what makes an off-list tag fail the build.** An off-list tag is
  a comment-parsing warning, which `treatValidationWarningsAsErrors` does not cover. Without it, an
  invented `@precondition` renders as prose and no gate objects.
- **`@internal` is how a symbol stays out of the public reference.** Something deliberately not
  public carries it, keeps its docs in source, and never reaches the site. Nothing goes into the
  public barrel only so it can carry docs.
- **A change that invalidates a doc block, a README, or an `architecture.md` seam updates it in the
  same commit.** A doc corrected one PR later was wrong in `main` for as long as that took.
- The two gates split description presence. TypeDoc owns interfaces, type aliases, classes, enums
  and plain variables. `docs-check.mjs` owns exported functions. This is not a preference.
  TypeDoc reaches a function only through its call signature. Asking it to check those also makes
  it demand a caption on every function-typed interface member. The rule against annotating
  members one by one forbids that.
- The check compiles every `@example`. Each package carries a root `doc-fixtures.d.ts` declaring the
  placeholder vocabulary examples may lean on, and an example may use only what that file declares.
- A throw is the function's contract wherever inside it the `throw` sits. So the check descends into
  nested closures and follows one hop through a `#src/*` import: every `canton-connect` hook throws
  through `useCantonConnectContext`, and `getExplorerLink` through a module-level guard. It stops at
  one hop, and at a throw the function's own `catch` swallows. `useCopyToClipboard` returns that
  failure as a value and owes no `@throws`.

## The generated reference

Its shape comes from reading wagmi, Mantine and TanStack Query rather than from invention, because
a reader arrives with habits from those. All three group the sidebar by *what a symbol is*, and
make every leaf something you call or render. They keep parameter and return types inside that
symbol's page.

- **Every barrel export carries an `@category`, and the vocabulary is a closed list**: `Components`,
  `Hooks`, `Utilities`, plus `Configuration`, `Types` and `Errors` where a package needs them. A new
  name is a decision about the whole reference, so it is a review conversation and not a free
  choice. `docs-check.mjs` errors on an untagged export. Untagged, it would fall back into
  TypeDoc's TypeScript-kind buckets, the flat "every interface together" listing the categories
  exist to replace.
- **The tag is `@category`, never `@group`.** Both render the same headings, but `includeGroups`
  also wraps each package's modules in a `Modules` node, while categories nest under the module.
- **A category holds a symbol and its supporting types**, so `Identifier` and `IdentifierProps` sit
  together. That is what `sort: alphabetical-ignoring-documents` is for. TypeDoc's default sorts by
  kind first, which lists every `*Props` ahead of every component it belongs to.
- **A sub-path that exists for packaging reasons merges into the main module.** `src/connect.ts`
  is a separate entry point because of what it pulls into a consumer's graph. That is no reason to
  file a component away from the others, so it carries `@mergeModuleWith Main`. The tag needs a
  bare `@module` beside it. Otherwise TypeDoc does not read the comment as a module comment and
  skips the merge in silence, and the `unusedMergeModuleWith` validation does not catch it either.
  Where a sub-path merges, the component's own block states the import path, since the tree no
  longer shows it. `canton-connect`'s `testing` module stays separate: those are doubles, and a fake
  provider listed beside the real one is a trap rather than a convenience.
- **A re-export cannot carry a tag.** TypeDoc resolves it to the upstream declaration, so it ignores
  a local `@category` on `export type { PrepareExecuteParams }`. `defaultCategory` catches those,
  which is safe only because every symbol with a local declaration must carry a tag.
- **`categoryOrder`, `defaultCategory`, `categorizeByGroup`, `groupOrder` and `sort` resolve per
  package** under `entryPointStrategy: "packages"`, so they live in each package's own
  `typedoc.json`. In `kit/typedoc.json`, TypeDoc accepts them and ignores them without a word. That
  reads as the tag not working rather than the option being in the wrong file. `kit/typedoc.json`
  owns entry points, validation, and `navigation`.
- **A link in a README or doc block is absolute, or it is not a link.** TypeDoc copies every
  relative link target into the published site and points the link at the copy, and no option
  disables it. So a relative path silently republishes the file, frozen at build time. The site
  also serves a `.ts` target as `video/mp2t`, which downloads instead of rendering. A file worth
  reaching from the reference gets its full
  `https://github.com/BootNodeDev/canton-dappbooster/blob/main/…` URL. Name a
  contributor-infrastructure file nobody reaches from the site in backticks, without a link.
  Nothing enforces this, so it is a review check.

## Authoring a component or hook

Applies wherever someone writes a component or hook, app or library alike. Only *styling* differs
by package, because only `canton-dappbooster` splits markup from styles across a package boundary;
its `CLAUDE.md` owns that contract. Nothing below differs.

- Render the element that carries the meaning, and keep the component legal where it renders: one
  rendered inline is a `span`, not a `div`.
- **Every state change a sighted user can see must reach assistive tech too.** Icons are
  `aria-hidden`, so a state carried only by an icon needs a live region or a changing accessible
  name. Two buttons where one looks selected need `aria-pressed`. Never leave this to the consumer.
- Expose that state on the element as `aria-*` or `data-*`, never through a class name alone. The
  styling hook and the accessibility state then stay one source of truth.
- `ref` is an ordinary prop (React 19), so do not reach for `forwardRef`. Do not declare it until a
  consumer needs one: a published prop is a contract owed forever, and adding it later is
  non-breaking.
- **State a component reads from a provider is never also a prop.** `isConnecting` and `partyId`
  on `<ConnectButton>` shadowed the wallet session. A caller could then contradict a connect already
  in flight, and the component had to pick a winner. One source, and a consumer wanting other
  behaviour composes the hook the provider already exports. This is what RainbowKit and ConnectKit
  do: no state props, a render-prop that *exposes* the same state if markup must differ.
- **A consumer's handler composes with the component's own action, never replaces it.** Run theirs
  first and treat the built-in as the default action, so `preventDefault` opts out explicitly;
  `onClick ?? doTheThing` silently drops the behaviour the component exists for. Where a state
  machine owns the handler, merge through its own utility (`mergeProps` in Zag) rather than by
  hand. A handler the library adds later then still runs.
- **A ternary is for a two-way toggle between two things to render. A guard clause is for bailing
  out of the whole render** (loading, error, no data). Two real faces get
  `cond ? <A /> : <B />`; a bail-out gets an `if` before the return.
- Tests assert on roles, accessible names, and whatever contract the component declares. Never on
  styling.

## Working rules

- Use **pnpm** only (never npm or yarn).
- This is a pnpm workspaces monorepo: one `pnpm install` from the repo root installs and links every package. There is no per-package install step.
- Run a subproject script either by `cd <subproject>` or by using `pnpm -C <subproject> run <script>`. The root `package.json` is the whole local loop, in order: `mint-token`, `build-dar`, `deploy-dar -- <dar>`, `bootstrap`, `app:dev`. Docs and `dev-stack.sh` use those names, not the underlying commands, so the implementation can move without a doc sweep. There is no `format` script anywhere: `lint:fix` is `biome check --write`, which formats too.
- **The LocalNet is not in this repository, and neither is its config.** It is
  `@bootnodedev/canton-barebones`, a pinned dev dependency driven with `start` / `stop` / `reset` in
  the directory holding `canton-barebones.config.json`. `up` scaffolds that directory itself through
  `scripts/localnet-config.mjs`, at the gitignored `.canton-localnet/`, so nobody edits or commits
  it. `scripts/dev-stack.sh` shells out to it in the directory given as a path-shaped first
  argument, which also opens the menu, the normal way to drive the stack. Otherwise it uses a second
  argument after the command, and then `CANTON_LOCALNET_DIR`. The command-line tool reads its
  config from its own working directory and writes the Splice checkout and the runtime env beside
  it, under `.generated/`.
- **`scripts/localnet-config.mjs` owns the two flags the stack cannot run without**
  (`validators.appUser.ui`, `sv.scanUI`). It scaffolds again from the installed template whenever
  that template moves past the local copy. One case is a new config version, which every command
  would otherwise reject. The other is a new Splice tag, which would otherwise pin the stack to a
  version nobody tested the tool against. Anything else set there survives until then, so a standing
  deviation belongs in a directory of its own via `CANTON_LOCALNET_DIR`, not in `.canton-localnet/`.
- `node canton-dappbooster/scripts/add-component.mjs <PascalCaseName>` scaffolds a component folder
  in that package. Not wired into `package.json`: it is an authoring convenience, not part of the
  loop described earlier.
- `pnpm run bootstrap` creates the vesting operator and its factory, which the
  dApp cannot start without. Run it after deploying the DAR. It writes no file. The dApp reads both
  back off the ledger once a wallet connects, so nothing can go stale between the two. Pointing the
  wallet at another participant is the whole of switching networks.
- **One `.env`, in `example-dapps/amulet-vesting/`.** It holds the signing recipe
  `scripts/mint-token.mjs` reads and the token `scripts/deploy-dar.sh` and the example's
  `scripts/bootstrap-vesting.mjs` send. The root scripts name that file, and the bootstrap resolves
  it from its own parent directory, so none takes a path argument. Minting is offline: no container
  has to be up. The dApp's `VITE_*` variables live there too. Its `vite.config.ts` calls `loadEnv`
  against its own folder with an empty prefix, so it reads every key in that file,
  `CANTON_AUTH_SECRET` included. Only what `parseEnv` returns may reach `define`, never the loaded
  object.
- **A `pnpm run` alias takes no arguments.** pnpm forwards the `--` separator to the script, so an
  alias over something reading `argv` mints the wrong thing in silence: `pnpm run mint-token --
  ledger-api-user` would sign for subject `-- ledger-api-user`. That is why `mint-token` bakes the
  subject in. `deploy-dar` is the one exception and handles it with an explicit `[ "$1" = "--" ] &&
  shift`, which is what lets it take `-- <dar>`.
- Local ports: the dApp dev server on 3012 and Wallet Gateway on 3030. Do not change either without updating `dev-stack.sh`, `wallet-gateway.config.json` and the `.env.example` defaults together.
- Treat the single root `pnpm-lock.yaml` as authoritative. Do not regenerate it as part of unrelated changes, and do not reintroduce per-package lockfiles.
- `pnpm-workspace.yaml` carries no `@canton-network/*` overrides. `canton-connect`'s `@canton-network/*` dependencies (`dapp-sdk`, `core-types`) live on the ranges in its own `package.json`; bump those directly and test the connect flow. It pins both its `core-types` and its `dapp-sdk` dev dependencies exact, not caret. Renovate's `@canton-network/**` hold only blocks version PRs, so a caret let lock file maintenance re-resolve the SDK past the hold (PR #79). The peer ranges stay caret so consumers keep a range, which is why the peer says `^1.4.0` while the pinned dev dependency is `1.5.1`.
- **`@walletconnect/sign-client` is a required peer of `canton-connect`, on purpose, even though
  `@canton-network/dapp-sdk` calls it optional.** The SDK's `peerDependenciesMeta` marks it optional
  but its `dist/index.js` imports it statically. So nothing that loads the SDK runs without it,
  whether or not the dApp ever uses WalletConnect. Mirroring the SDK's declaration shipped 0.3.0
  with no copy in a consumer tree. pnpm installed nothing and warned about nothing, two of the
  vesting dApp's test files failed, and the bundle rendered a blank page. Its production build still
  exited 0, because Vite 8 turns an unresolved import into a throwing stub, which is how it reached
  npm. `example-dapps/amulet-vesting` also lists it in `dependencies` on the same range. pnpm and
  npm install peers on their own, yarn does not, and a consumer can turn that off. It can go back to
  optional once upstream moves that import behind a dynamic one.
- `pnpm-workspace.yaml` lists the packages allowed to run build scripts under `allowBuilds`: `esbuild`, `protobufjs`, and the three Wallet Gateway compiles natively (`better-sqlite3`, `cbor-extract` and `secp256k1`). pnpm blocks anything else until someone adds it.
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## `kit/`

`kit/` holds the root tooling that reads the three libraries' source, scripts and config together.
That is the doc, anatomy and version gates, the release bump, and the `typedoc` configs. Tooling
that belongs to one package lives in that package, as `canton-dappbooster/scripts/add-component.mjs`
does. `manifests.mjs` is in `kit/` because only `check-versions.mjs` and `release-version.mjs`
import it.

No project a user creates contains this repo. `create-canton-dappbooster` copies
`canton-create/scaffold/` and the example packages, so nothing at the root has to keep working
without the libraries. The root `scripts/` run the monorepo's own loop against
`example-dapps/amulet-vesting`. `canton-create/scaffold/daml-tooling/scripts/` and
`canton-create/scaffold/localnet/scripts/` are copies adapted to a project's layout, so a fix to
one copy usually belongs in the other.

## Packaging and publishing

The three libraries, `canton-connect`, `canton-dappbooster` and `canton-theme`, publish to npm
under `@bootnodedev/`. All three are `private: false` with `publishConfig.access: "public"`, since
the scope is private by default on npm.

All three declare `"license": "MIT"`, the root `LICENSE`. None of them carries a copy of that file.
When a package has no `LICENSE` of its own, pnpm packs the workspace root's into it. The tarball
ships the text, and the repo holds one copy.

**Depend on a library by version range, never `workspace:*`.** `pnpm-workspace.yaml` sets
`linkWorkspacePackages: true`. So pnpm links the local folder whenever that folder's own `version`
satisfies the range, and downloads from npm when it does not. `example-dapps/amulet-vesting` and
`canton-dappbooster` both ask for `^0.3.1`, and the three folders are all on `0.3.1`, so every one
of them links today. That is what lets a single `package.json` serve two readers:

- In this repo the three folders exist and are in range. An edit in `canton-connect/src` then shows
  up in the dApp with no build and no republish.
- In a project `create-canton-dappbooster` makes, the folders are absent, so pnpm installs the
  published versions. Nothing in the file changes between the two.

That is the whole difference between working here and consuming the kit. A `workspace:*` range would
break the second case: it is not a range npm can resolve.

**Bumping a library past its declared range silently stops linking it.** Set `canton-connect` to
`0.4.0` and leave the `^0.3.1` in `canton-dappbooster` and `example-dapps/amulet-vesting`. The next
install then stops linking the folder and pulls `0.3.x` off npm instead. Local edits then have no
visible effect, and nothing about the install says so. A version bump therefore has to update every
range that points at that package in the same commit. That is what `kit/release-version.mjs` below
does, and what `pnpm run check:versions` refuses to let drift. To check it, look for the
symlink: `ls -l example-dapps/amulet-vesting/node_modules/@bootnodedev/`.

**A library's top-level `exports` is for us; `publishConfig.exports` is for consumers.** Top-level
carries the `development` condition that points at `src`. The dev loop compiles through it, and
`canton-dappbooster`'s `customConditions` depends on it. `files` ships only `dist`, so that
condition would be a dead path in a consumer's `node_modules`. `publishConfig.exports` mirrors the
top-level map with the `development` entries removed, and npm swaps it in at publish time. What a
consumer resolves then points only at `dist`. Add a sub-path to one map and add it to the other:
they are two hand-maintained copies of the same list, and nothing compares them. `canton-theme`
ships `src` and has no such condition, so it needs no override.

`prepack: tsdown` in both TypeScript libraries rebuilds `dist` on every `pnpm pack` and
`pnpm publish`, so a stale or missing build cannot ship. It replaced a `prepublishOnly` that failed
every publish on purpose, back when the `development` condition had no override to strip it.

`pnpm run release` from the root is
`pnpm -r --filter './canton-*' publish --no-git-checks`. `pnpm -r` walks the workspace in dependency
order, so `canton-connect` publishes before `canton-dappbooster`, which depends on it.

**Every public workspace package moves in lockstep**: the root `package.json`, the three libraries,
`create-canton-dappbooster` and each example. The private `canton-create/scaffold/` folders keep
their own. An example's contract has a version of its own, `version` in its `daml/daml.yaml`, which
names the built DAR.

**`node kit/release-version.mjs 0.4.0` does the whole bump.** `pnpm run release:version 0.4.0`
is the same thing. Never spell it with a `--` separator, which pnpm forwards into `argv`, so the
version arrives as `--`. In order, it:

1. refuses a malformed version, a dirty working tree, or a `v0.4.0` tag that already exists
2. writes the version into every public manifest, and rewrites every range pointing at a library to
   `^0.4.0`. It reads the manifests listed in `kit/manifests.mjs`, and a library is any of them that
   is not private. A new workspace package has to go on that list, or the bump skips it
3. runs `pnpm install`, then commits the manifests and `pnpm-lock.yaml` as `release: v0.4.0`, tags
   `v0.4.0`, and pushes the branch and the tag
4. opens a **draft** GitHub release with generated notes, `--prerelease` when the version has a
   prerelease part

A prerelease version goes into both halves, which is what keeps the folders linked through a
release candidate: `^0.4.0-rc.0` does satisfy `0.4.0-rc.0`.

**Publishing that draft is the only irreversible step, and it is a human click.**
`.github/workflows/release.yml` runs on `release: published`. It checks the tag out and runs
`node kit/check-versions.mjs` with the tag minus its `v`, so a mistyped tag cannot reach npm. It
then runs `pnpm lint`, `pnpm typecheck` and `pnpm test`, and publishes with the root `release`
script. `--no-git-checks` is what lets it publish from that detached HEAD.

**Publishing authenticates to npm through OIDC trusted publishing, so there is no token and no repo
secret.** Each of the three
packages has a trusted publisher on npmjs.com naming this repo and the workflow file. The job
proves it is that workflow with a short-lived OIDC token. `id-token: write` in the top-level
`permissions` is what lets it request one, and without that key the publish fails with no token to
fall back on. `setup-node`'s `registry-url` is still needed: it writes the `.npmrc` that
points pnpm at npmjs.org.

**Those npmjs.com entries name `release.yml` by filename.** Renaming or moving the workflow breaks
publishing until someone updates all three to match, and nothing in this repo can warn about it.

**Every published package declares `repository`, with its own `directory`.** Trusted publishing
attaches a Sigstore provenance bundle naming the repository the build came from. The registry compares
that claim against the package's own `repository.url`. The registry does not treat a missing field as
"nothing to check". The comparison runs against an empty string, and the upload fails with a 422 saying
`"repository.url" is ""`, which names no cause a reader can act on. The URL is the `https` form
(`git+https://github.com/BootNodeDev/canton-dappbooster.git`). That is the form the provenance claim
carries and what npm normalises against; the repo's SSH-only rule covers git remotes, not this.
`directory` is the package's path from the repo root, so npm and editors resolve links into the
right folder instead of the monorepo root. The root `package.json` is private and never published,
so it needs none. A manual publish from a laptop has no provenance to verify. That is why 0.3.0
went out without the field and v0.3.1 was the first to hit this.

**A prerelease publishes under the `next` dist-tag**, keyed off `github.event.release.prerelease`,
so a release candidate never becomes what `npm install` resolves. `pnpm -r publish` skips a package
whose version is already on npm, so re-running the workflow after a partial failure is safe.

`pnpm run release:dry` packs every package `release` publishes and uploads nothing, which is how to
look at a tarball's contents before a release.

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `pnpm -C`:
  - `example-dapps/amulet-vesting`: `pnpm test` (`vitest` + `jsdom`, though it asserts on no DOM:
    the wallet SDK reached through `canton-connect` touches DOM global objects on import)
  - `canton-connect`: `pnpm test` (`vitest` + `jsdom`)
  - `canton-create`: `pnpm test` (`vitest` + `ink-testing-library`)
  - `canton-dappbooster`: `pnpm test` (`vitest` + `jsdom` + Testing Library)
  - root `scripts/` and `kit/`: covered by the root `pnpm test`, which appends
    `node --test "scripts/**/*.test.mjs" "kit/**/*.test.mjs"` to the fan-out because `pnpm -r` skips
    the root package. The version lockstep check is one of those tests,
    `kit/check-versions.test.mjs`
- `canton-dappbooster` tests the kit components (`vitest` + `jsdom`). The `vitest` run in `example-dapps/amulet-vesting` covers its pure logic wherever that lives. Component and DOM behaviour, and app+kit integration, are out of scope there.
- From the root, `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm knip` fan out across every workspace (`pnpm -r --if-present`). A contract is not a workspace build. `pnpm build-dar` builds the vesting one and needs `dpm` and a network fetch of the Splice DARs, so CI does not run it.
- `pnpm docs:check` (TypeDoc plus `kit/docs-check.mjs`), `pnpm run check:anatomy` and `pnpm run check:versions` do not fan out. Each reads the packages it covers directly, and TypeDoc has one config over both libraries. `pnpm docs:build` writes the reference site to `typedoc/`.
- Cover the paths that matter: business logic, API integrations, component behaviour. Skip styling, third-party library internals, and code that only reads or writes a field.

## Commit standards

Use [Conventional Commits](https://www.conventionalcommits.org/).

**Format:** `type(scope): subject`

- **Scope** is optional: `feat: add login` and `feat(auth): add login` are both valid.
- **Subject** uses imperative mood, lowercase after the colon, no trailing period.
- **Body** (optional) follows a blank line and explains *what* and *why*.

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

## PR workflow

- Every PR must reference an issue (`Closes #N`).

  > No related issue? Use `No related issue.` as the first line of the Summary section.

- Mirror the issue's acceptance criteria in the PR.
- Self-review your diff before requesting peer review.
- Keep PRs small and focused: one issue, one PR.
- PR titles use the same Conventional Commit format (`feat: add user dashboard`).
- The `create-pr` skill at `.claude/skills/create-pr/` reads [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) and fills every section automatically.

## Label conventions

GitHub form dropdowns (like the Priority field in issue templates) only work through the web UI. When someone creates an issue with the `gh` command-line tool or the REST API, dropdown values become unstructured body text. Nothing can filter on that text, and it is never consistent. **Labels are the API-reliable mechanism for structured metadata.**

**Priority** (bugs, features, and epics):

| Label | Description |
|-------|-------------|
| `priority: critical` | Blocking work, system down, or security issue |
| `priority: high` | Must land in the current sprint |
| `priority: medium` | Should land soon |
| `priority: low` | Nice to have, can wait |

Filter issues by label with `gh issue list --label "priority: high"`.

The `create-issue` skill at `.claude/skills/create-issue/` applies these labels automatically when it creates issues through `gh`.

## Guardrails

- Do not commit secrets, API keys, or credentials. Git ignores `.env.local` files; keep it that way.
- Do not modify CI/CD pipelines without team review.
- Do not skip tests or linting to make a build pass.
- Do not bypass the Husky hooks (`--no-verify`) unless the user explicitly asks.
- **Create a party the dApp acts as with the gateway's `wallet-kernel` signing provider, never
  `participant`.** The validator installs a `WalletAppInstall` for a participant-hosted party, and
  its automation then merges that party's Amulets, archiving the one a grant pledges. The proposal
  keeps a dead `amuletCids`, and `AmuletVestingProposal_Accept` fails with `Rejected transaction is
  referring to inactive contracts`. Measured on a LocalNet: a transaction with no `commandId`
  archived a participant party's split Amulet 79 seconds after its creation. A `wallet-kernel` party
  got no install and kept both Amulets. The bootstrap operator is exempt: it holds no Amulets and
  only signs the factory.
- **The repo commits `wallet-gateway.config.json`, unlike the LocalNet's config.** It is ours rather
  than a tool's template, and it is three dozen lines. The LocalNet values in it are the published
  unsafe ones (`unsafe` as the signing secret, `https://canton.network.global` as the audience). Its
  two SQLite stores land in the gitignored `.wallet-gateway/`. The `wallet-gateway` script creates
  that folder, because better-sqlite3 refuses a database in a directory that does not exist.
- **A `ledgerApi` route names its path segments as a template, with the values in `path`.**
  `/v2/users/{user-id}/rights` plus `path: { 'user-id': id }`, never `/v2/users/${id}/rights`. The
  gateway lets a resource through only when it matches the ledger API's own route list. An
  interpolated id matches nothing and comes back as `Unsupported get resource`. wallet-service
  passed anything through, which is why this only surfaced on the move.
- **Never edit the root `README.md` unless explicitly told to in that request.** No
  doc-sync sweep, no "update docs in the same commit" rule and no `update-docs` run
  authorizes editing it. This rule does not cover a subproject's README.
- When in doubt, ask. Don't assume.

## Change strategy

- Prefer small, focused diffs over broad refactors.
- Preserve existing UX unless the task explicitly changes it.
- Avoid introducing new patterns when a project pattern already exists.
- Update docs only when behaviour or workflow changes.

## Validation checklist

Before declaring monorepo-touching work done:

- Subproject-level: `pnpm run lint` and `pnpm test` inside any subproject you touched.
- Root-level: reproduce the CI `pr` gate locally with `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm knip`, `pnpm docs:check`, `pnpm run check:anatomy`, `pnpm run check:versions`.
- `git push --dry-run` exercises the pre-push hook (`pnpm typecheck` + gitleaks scan of the outgoing range).
- Every PR must pass the `.github/workflows/pr.yml` gate and one approval before `main` accepts it.
- For the full end-to-end loop (LocalNet up, DAR built and deployed, bootstrap, wallet, dApp), follow [`README.md`](README.md).

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 dApp Standard](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
