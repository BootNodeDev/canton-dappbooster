<!-- starter-kit: v2026.08 -->

# Agent Configuration — Canton dApp Booster

This file is the canonical monorepo-wide agent configuration. `AGENTS.md`
files are compatibility shims that point here or to a sibling `CLAUDE.md`.
Each subproject can layer its own `CLAUDE.md` for stack-specific deltas:

- [`canton-connect/CLAUDE.md`](canton-connect/CLAUDE.md) — wagmi-style React hooks for Canton dApps
- [`canton-dappbooster/CLAUDE.md`](canton-dappbooster/CLAUDE.md) — L2 component authoring and file layout
- [`canton-theme/CLAUDE.md`](canton-theme/CLAUDE.md) — L3 `--cnc-*` token naming convention
- [`canton-barebones/wallet-service/CLAUDE.md`](canton-barebones/wallet-service/CLAUDE.md) — wallet-service bridge rules
- `canton-barebones/`, `dapp/daml/vesting-lite/`, `dapp/frontend/` — see each subproject's `README.md`

`dapp/frontend/` has no `CLAUDE.md`; its seams are in
[`dapp/frontend/architecture.md`](dapp/frontend/architecture.md).

The Carpincho wallet (CIP-0103 browser wallet) lives in its own repository at
[github.com/BootNodeDev/carpincho-wallet](https://github.com/BootNodeDev/carpincho-wallet); it is no longer part of this monorepo.

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

Current distribution:

| Scope | README | AGENTS | CLAUDE | architecture | Decision |
|-------|--------|--------|--------|--------------|----------|
| root | yes | shim | yes | yes | Canonical repo rules and cross-component seams. |
| `canton-connect/` | yes | shim | yes | yes | Public hook API, the facade's adapter/picker seams, provider event wiring. |
| `canton-barebones/wallet-service/` | yes | shim | yes | no | Local bridge rules are useful; README API boundary is enough architecture for now. |
| `dapp/frontend/` | yes | no | no | yes | Canton Coin vesting dApp; root rules suffice for authoring, but its internal seams outgrew the README. Carries a `PROVENANCE.md` recording the vendored source. |
| `dapp/daml/` | yes | no | no | no | Single DAML package (`vesting-lite`) plus its `daml-test` scenarios. Carries a `PROVENANCE.md` recording the vendored source. |
| `canton-barebones/` | yes | no | no | no | Docker/Bash local participant wrapper. |
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
| Languages | TypeScript, DAML, Bash | TypeScript across the JS subprojects; DAML in `dapp/daml/vesting-lite/`; Bash for canton-barebones scripts |
| Package manager | pnpm workspaces | Single root `pnpm-lock.yaml`; one root `pnpm install` links every workspace. Workspace layout + overrides live in `pnpm-workspace.yaml`. Root `package.json` orchestrates scripts via `pnpm -C <dir>` |
| Node | 24 | Exact version pinned via root `.nvmrc`; inherits to every Node subproject. The four subprojects that declare `engines.node` floor it at `>=24.15.0`, which is what jsdom 30 requires |
| Container runtime | Docker | Used by `canton-barebones/` for the local participant + Postgres |
| Commit linting | commitlint + husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config. `pnpm lint` = `biome check --error-on-warnings` (warnings fail); standalone SVG assets are excluded |
| Pre-commit | lint-staged | Root `.lintstagedrc.mjs` runs root Biome (`biome check --write`) across `canton-connect/`, `canton-dappbooster/`, `canton-theme/`, `dapp/frontend/`, and `canton-barebones/` |
| Pre-push | tsc | Root `.husky/pre-push` runs `pnpm typecheck` (`pnpm -r run --if-present typecheck`, i.e. `tsc` in each Node subproject that defines it) |
| Secret scanning | gitleaks | Shared `.husky/gitleaks.sh` runs gitleaks in the pre-commit (staged diff) and pre-push (outgoing range) hooks; the pinned version (`.gitleaks-version`) is installed by `scripts/install-gitleaks.sh`, so local and CI use the same rules. Accepted non-secret findings live in `.gitleaksignore` |
| Dead code | knip | Root `knip.json` + `pnpm knip`; gates unused files/dependencies/exports. `@canton-network/*` ignored |
| CI | GitHub Actions | `.github/workflows/pr.yml` gate on every PR (biome, typecheck+build+knip, test, commitlint, gitleaks). `main` is protected: 1 approval + all checks green. `add-to-project` and `pr-assign` automate the board and PR assignee |
| Dependency updates | Renovate | `renovate.json`: non-major updates batched weekly, no auto-merge; the `@canton-network/*` SDK graph is held for manual approval on the Dependency Dashboard |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`canton-barebones/`](canton-barebones/) | Local Canton participant + Postgres via docker-compose; deploy + health + token scripts | Docker, Bash, Node scripts | 3013/3014/3015/3016/3017/3018 |
| [`dapp/daml/vesting-lite/`](dapp/daml/vesting-lite/) | `vesting-lite` DAML model: factory, proposal, contract, residual claim. Scenarios in `dapp/daml-test/` | DAML | n/a (DAR artifact) |
| [`canton-barebones/wallet-service/`](canton-barebones/wallet-service/) | JSON-RPC bridge between the wallet and the Canton participant. Started by `pnpm run canton:up`. Self-mints its Canton JWT. | Node + Express + TypeScript | 3010 |
| [`dapp/frontend/`](dapp/frontend/) | Canton Coin vesting dApp over the local participant. Every read and write goes through the connected CIP-0103 wallet via `canton-connect`; the operator's factory arrives by explicit disclosure from `scripts/bootstrap-vesting-lite.mjs`'s config file. Imported from `cn-dappbooster@feat/vesting-lite` (see its `PROVENANCE.md`). | Vite + React + Tailwind v4 + zustand + react-router + Biome | 3012 |
| [`canton-connect/`](canton-connect/) | wagmi-style React hooks wrapping the `dapp-sdk` facade; the SDK owns discovery, the picker, the session and the transports | TypeScript + React 19 + Biome | n/a (library) |
| [`canton-dappbooster/`](canton-dappbooster/) | L2 headless UI components for Canton dApps (tsdown-built, zero styling), plus the light/dark/system theme runtime that drives `data-theme`, plus the pure utilities the components are built on, the exact-decimal amount ones included. Styling lives in `canton-theme`. `src/index.ts` is the public API; `src/connect.ts` is the `/connect` sub-path, holding the components that read the wallet session so the main barrel stays free of the Canton SDK. | TypeScript + React 19 + tsdown + vitest + Biome | n/a (library) |
| [`canton-theme/`](canton-theme/) | L3 plain-CSS theme for the kit: `--cnc-*` tokens + prestyled defaults, consumed by importing its CSS. | CSS | n/a (library) |

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
| Class or instantiable module | PascalCase | `LiteBackend.ts` |
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
  Routed pages are the one thing kept apart, in `features/`, because the router enters them rather
  than a parent composing them.
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
- Every symbol a package exports from its public barrel carries a JSDoc block: what it does, where
  a caller could reasonably pick a different export, when to reach for it, and at least one
  `@example`. Do not restate the type.
- **A module has one legal spelling, and it is never relative.** `./components/toast` and
  `@/components/toast` both resolved, so which one landed was down to who or what wrote the file.
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
- `canton-barebones/` is exempt from both rules. It runs on `NodeNext`, where the extension is
  load-bearing, so its imports keep `.ts`; and `tsc -p .` emits to `dist/` while an `imports` map
  would still point at `./src/*.ts`, so a compiled `dist/server.js` would resolve back into
  TypeScript source. Relative specifiers with extensions are correct there and lint allows them.

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
- Tests assert on roles, accessible names, and whatever contract the component declares. Never on
  styling.

## Working Rules

- Use **pnpm** only (never npm or yarn).
- This is a pnpm workspaces monorepo: one `pnpm install` from the repo root installs and links every package. There is no per-package install step.
- Run a subproject script either by `cd <subproject>` or by using `pnpm -C <subproject> run <script>`. The root `package.json` exposes orchestration shortcuts:
  - `pnpm run canton:up` / `canton:down` / `canton:health` / `canton:token`
  - `pnpm run build-dar -- <daml-project>` / `pnpm run deploy-dar -- <dar>`
  - `pnpm run app:dev`
- `node scripts/add-component.mjs <PascalCaseName>` scaffolds a `canton-dappbooster` component
  folder. Not wired into `package.json`: it is an authoring convenience, not part of the loop above.
- `node scripts/bootstrap-vesting-lite.mjs` creates the vesting operator and its factory and writes
  `dapp/frontend/public/vesting-lite-parties.json`, which the dApp cannot start without. Run it after
  the DAR is deployed. It takes the package id from the participant, never a default, because a stale
  one shows as an empty dashboard with no error.
- Local ports are intentionally assigned in the `3010+` range (see table above). Do not change them without updating every subproject's defaults.
- Treat the single root `pnpm-lock.yaml` as authoritative. Do not regenerate it as part of unrelated changes, and do not reintroduce per-package lockfiles.
- `pnpm-workspace.yaml` pins `@canton-network/wallet-sdk` and `core-acs-reader` via `overrides`, at the versions wallet-service was verified against. `canton-connect`'s `@canton-network/*` deps (`dapp-sdk`, `core-types`) are not part of these overrides — they live on the ranges in its own `package.json`; bump those directly and test the connect flow, not `pnpm-workspace.yaml`. Its `core-types` devDependency is pinned exact, not caret: Renovate's `@canton-network/**` hold only blocks version PRs, so a caret let lock file maintenance re-resolve the SDK past the hold (PR #79). The peer range stays caret so consumers keep a range. `dapp-sdk` `^1.4.0` still has this exposure.
- Build scripts are gated in `pnpm-workspace.yaml` under `allowBuilds` (`esbuild`/`protobufjs` allowed; `puppeteer` blocked so `@mermaid-js/mermaid-cli` does not download a Chromium).
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `pnpm -C`:
  - `dapp/frontend`: `pnpm test` (vitest + jsdom, though it asserts on no DOM: the wallet SDK
    reached through `canton-connect` touches DOM globals on import)
  - `canton-connect`: `pnpm test` (vitest + jsdom)
  - `canton-barebones`: `pnpm test` (Node `node:test` against the scripts)
  - `canton-dappbooster`: `pnpm test` (vitest + jsdom + Testing Library)
- Kit components are tested inside `canton-dappbooster` (vitest + jsdom). `dapp/frontend`'s vitest run covers its pure logic wherever that lives; component/DOM behaviour and app+kit integration are out of scope there.
- From the root, `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm knip` fan out across every workspace (`pnpm -r --if-present`). CI runs these minus `dapp/daml/vesting-lite`'s build (needs `dpm`).
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
- When in doubt, ask — don't assume.

## Change Strategy

- Prefer small, focused diffs over broad refactors.
- Preserve existing UX unless the task explicitly changes it.
- Avoid introducing new patterns when a project pattern already exists.
- Update docs only when behaviour or workflow changes.

## Validation Checklist

Before declaring monorepo-touching work done:

- Subproject-level: `pnpm run lint` and `pnpm test` inside any subproject you touched.
- Root-level: reproduce the CI `pr` gate locally with `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm knip`.
- `git push --dry-run` exercises the pre-push hook (`pnpm typecheck` + gitleaks scan of the outgoing range).
- Every PR must pass the `.github/workflows/pr.yml` gate and one approval before `main` accepts it.
- For the full end-to-end loop (Canton up → DAR built → DAR deployed → wallet-service → wallet → dApp), follow [`README.md`](README.md) §1–6.

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 Canton wallet provider spec](https://github.com/digital-asset/canton/tree/main/community/app/src/pack/examples/04-canton-wallet)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
