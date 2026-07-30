<!-- starter-kit: v2026.07 -->

# Agent Configuration — Canton dApp Booster

This file is the canonical monorepo-wide agent configuration. `AGENTS.md`
files are compatibility shims that point here or to a sibling `CLAUDE.md`.
Each subproject can layer its own `CLAUDE.md` for stack-specific deltas:

- [`canton-connect-kit/CLAUDE.md`](canton-connect-kit/CLAUDE.md) — wagmi-style React hooks for Canton dApps
- [`canton-barebones/wallet-service/CLAUDE.md`](canton-barebones/wallet-service/CLAUDE.md) — wallet-service bridge rules
- `canton-barebones/`, `dapp/daml/`, `dapp/frontend/` — see each subproject's `README.md`

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
| `canton-connect-kit/` | yes | shim | yes | yes | Public hook API, connector abstractions, provider event wiring. |
| `canton-barebones/wallet-service/` | yes | shim | yes | no | Local bridge rules are useful; README API boundary is enough architecture for now. |
| `dapp/frontend/` | yes | no | no | no | Canton Coin vesting dApp (mock-first); root rules + README suffice. Carries a `PROVENANCE.md` recording the vendored source. |
| `dapp/daml/` | yes | no | no | no | Single DAML package. |
| `canton-barebones/` | yes | no | no | no | Docker/Bash local participant wrapper. |
| `canton-dappbooster/` | yes | no | no | yes | L2 headless components; architecture.md holds the authoring seam (anatomy contract, L2/L3 split, Zag boundary). |
| `canton-theme/` | yes | no | no | no | Plain-CSS theme (L3); README covers the two CSS exports. |

Subproject docs must not restate root rules. They should describe only their local delta and link upward.

## Stack & Conventions (monorepo)

| Category | Technology | Notes |
|----------|-----------|-------|
| Languages | TypeScript, DAML, Bash | TypeScript across the JS subprojects; DAML in `dapp/daml/`; Bash for canton-barebones scripts |
| Package manager | pnpm workspaces | Single root `pnpm-lock.yaml`; one root `pnpm install` links every workspace. Workspace layout + overrides live in `pnpm-workspace.yaml`. Root `package.json` orchestrates scripts via `pnpm -C <dir>` |
| Node | 24 | Pinned via root `.nvmrc`; inherits to every Node subproject |
| Container runtime | Docker | Used by `canton-barebones/` for the local participant + Postgres |
| Commit linting | commitlint + husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config. `pnpm lint` = `biome check --error-on-warnings` (warnings fail); standalone SVG assets are excluded |
| Pre-commit | lint-staged | Root `.lintstagedrc.mjs` runs root Biome (`biome check --write`) across `canton-connect-kit/`, `canton-dappbooster/`, `canton-theme/`, `dapp/frontend/`, and `canton-barebones/` |
| Pre-push | tsc | Root `.husky/pre-push` runs `pnpm typecheck` (`pnpm -r run --if-present typecheck`, i.e. `tsc` in each Node subproject that defines it) |
| Secret scanning | gitleaks | Shared `.husky/gitleaks.sh` runs gitleaks in the pre-commit (staged diff) and pre-push (outgoing range) hooks; the pinned version (`.gitleaks-version`) is installed by `scripts/install-gitleaks.sh`, so local and CI use the same rules. Accepted non-secret findings live in `.gitleaksignore` |
| Dead code | knip | Root `knip.json` + `pnpm knip`; gates unused files/dependencies/exports. `@canton-network/*` ignored |
| CI | GitHub Actions | `.github/workflows/pr.yml` gate on every PR (biome, typecheck+build+knip, test, commitlint, gitleaks). `main` is protected: 1 approval + all checks green. `add-to-project` and `pr-assign` automate the board and PR assignee |
| Dependency updates | Renovate | `renovate.json`: non-major updates batched weekly, no auto-merge; the `@canton-network/*` SDK graph is held for manual approval on the Dependency Dashboard |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`canton-barebones/`](canton-barebones/) | Local Canton participant + Postgres via docker-compose; deploy + health + token scripts | Docker, Bash, Node scripts | 3013/3014/3015/3016/3017/3018 |
| [`dapp/daml/`](dapp/daml/) | `quickstart-tally` DAML model | DAML | n/a (DAR artifact) |
| [`canton-barebones/wallet-service/`](canton-barebones/wallet-service/) | JSON-RPC bridge between the wallet and the Canton participant. Started by `pnpm run canton:up`. Self-mints its Canton JWT. | Node + Express + TypeScript | 3010 |
| [`dapp/frontend/`](dapp/frontend/) | Canton Coin vesting dApp; runs mock-first (DirectWallet party-picker + in-memory backend, no services). Imported from `cn-dappbooster@feat/vesting-lite` (see its `PROVENANCE.md`); live ledger + CIP-0103 path deferred. | Vite + React + Tailwind v4 + zustand + react-router + Biome | 3012 |
| [`canton-connect-kit/`](canton-connect-kit/) | wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets | TypeScript + React 19 + Biome | n/a (library) |
| [`canton-dappbooster/`](canton-dappbooster/) | L2 headless UI components for Canton dApps (tsdown-built, zero styling). Styling lives in `canton-theme`. The temporary `Placeholder` + its `dapp/frontend` use are replaced by `<Identifier>` in #6. | TypeScript + React 19 + tsdown + vitest + Biome | n/a (library) |
| [`canton-theme/`](canton-theme/) | L3 plain-CSS theme for the kit: `--cnc-*` tokens + prestyled defaults, consumed by importing its CSS. | CSS | n/a (library) |

## Code Style

- All source code in English regardless of conversation language.
- TypeScript preferred over JavaScript across Node subprojects.
- **No semicolons** in TypeScript / JavaScript across the repo.
- **Comments are terse and explain *why*, not *what*.** Prefer one line. Do not restate what the code already says, narrate steps, or write multi-line prose where a short clause suffices. If the code needs a paragraph to be understood, simplify the code instead.
- Lint and formatting are centralized in the root `biome.json`. Add project-specific rules under `overrides` keyed by path; do not create per-subproject Biome configs.

## Working Rules

- Use **pnpm** only (never npm or yarn).
- This is a pnpm workspaces monorepo: one `pnpm install` from the repo root installs and links every package. There is no per-package install step.
- Run a subproject script either by `cd <subproject>` or by using `pnpm -C <subproject> run <script>`. The root `package.json` exposes orchestration shortcuts:
  - `pnpm run canton:up` / `canton:down` / `canton:health` / `canton:token`
  - `pnpm run build-dar -- <daml-project>` / `pnpm run deploy-dar -- <dar>`
  - `pnpm run app:dev`
- Local ports are intentionally assigned in the `3010+` range (see table above). Do not change them without updating every subproject's defaults.
- Treat the single root `pnpm-lock.yaml` as authoritative. Do not regenerate it as part of unrelated changes, and do not reintroduce per-package lockfiles.
- `pnpm-workspace.yaml` pins the whole `@canton-network/*` family via `overrides`: `dapp-sdk` at `1.1.0` and the `core-*` packages at the exact versions the stack was verified against. The SDK ships breaking changes inside its `^1.x` range (e.g. `core-provider-dapp` 1.8 drops an export `dapp-sdk` 1.1 imports), so without the pins pnpm resolves an incompatible set. `1.2.0` of `dapp-sdk` is intentionally held back. Do not bump these without testing the dApp flow against the newer SDK.
- Build scripts are gated in `pnpm-workspace.yaml` under `allowBuilds` (`esbuild`/`protobufjs` allowed; `puppeteer` blocked so `@mermaid-js/mermaid-cli` does not download a Chromium).
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `pnpm -C`:
  - `dapp/frontend`: `pnpm test` (vitest, node env)
  - `canton-connect-kit`: `pnpm test` (Node `node:test` + `tsx`)
  - `canton-barebones`: `pnpm test` (Node `node:test` against the scripts)
  - `canton-dappbooster`: `pnpm test` (vitest + jsdom + Testing Library)
- Kit components are tested inside `canton-dappbooster` (vitest + jsdom). `dapp/frontend`'s vitest run covers its pure logic — schedule math, the mock backend, the store, and the ACS→domain mappers; component/DOM behaviour and app+kit integration are out of scope there.
- From the root, `pnpm test` / `pnpm typecheck` / `pnpm build` / `pnpm knip` fan out across every workspace (`pnpm -r --if-present`). CI runs these minus `dapp/daml`'s build (needs `dpm`).
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

The `issue` skill at `.claude/skills/issue/` applies these labels automatically when creating issues via CLI.

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
