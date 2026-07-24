# Agent Configuration — Canton dApp Booster

This file is the canonical monorepo-wide agent configuration. `CLAUDE.md`
files are compatibility shims that point here or to a sibling `AGENTS.md`.
Each subproject can layer its own `AGENTS.md` for stack-specific deltas:

- [`carpincho-wallet/AGENTS.md`](carpincho-wallet/AGENTS.md) — CIP-0103 wallet (Vite + React + Biome)
- [`canton-connect-kit/AGENTS.md`](canton-connect-kit/AGENTS.md) — wagmi-style React hooks for Canton dApps
- [`canton-barebones/wallet-service/AGENTS.md`](canton-barebones/wallet-service/AGENTS.md) — wallet-service bridge rules
- [`dapp/e2e/AGENTS.md`](dapp/e2e/AGENTS.md) — Playwright black-box integration test rules
- `canton-barebones/`, `dapp/daml/`, `dapp/frontend/` — see each subproject's `README.md`

For the system shape (data flow, components, ports), see [`architecture.md`](architecture.md).

---

## Documentation Distribution

Use one reader per doc type, layered by scope:

| File | Reader / question | Distribution rule |
|------|-------------------|-------------------|
| `README.md` | Human: what is this and how do I run it? | Every independently buildable, runnable, publishable, or testable unit gets one. Subproject READMEs cover only that unit and link to the root README for shared setup. |
| `AGENTS.md` | Agent: what local rules change how I edit here? | Root always. Subproject only when local conventions differ from root enough that an agent editing only that directory would get it wrong. Deltas only; link upward for repo-wide rules. |
| `CLAUDE.md` | Claude compatibility loader | Three-line shim beside every `AGENTS.md`, pointing to the sibling `AGENTS.md`. It is never canonical. |
| `architecture.md` | Human or agent: what are the structural seams and internal subsystems? | Root always for cross-component seams. Subproject only when internals outgrow the README: three or more interacting subsystems, non-trivial control flow, or named abstractions. |

Current distribution:

| Scope | README | AGENTS | CLAUDE | architecture | Decision |
|-------|--------|--------|--------|--------------|----------|
| root | yes | yes | shim | yes | Canonical repo rules and cross-component seams. |
| `carpincho-wallet/` | yes | yes | shim | yes | Complex wallet internals: vault, provider, extension, WalletConnect, theme, session. |
| `canton-connect-kit/` | yes | yes | shim | yes | Public hook API, connector abstractions, provider event wiring. |
| `canton-barebones/wallet-service/` | yes | yes | shim | no | Local bridge rules are useful; README API boundary is enough architecture for now. |
| `dapp/e2e/` | yes | yes | shim | no | Independent Playwright package with strict black-box testing conventions. |
| `dapp/frontend/` | yes | no | no | no | Small dApp UI; root rules and README are enough. |
| `dapp/daml/` | yes | no | no | no | Single DAML package. |
| `canton-barebones/` | yes | no | no | no | Docker/Bash local participant wrapper. |

Subproject docs must not restate root rules. They should describe only their local delta and link upward.

## Stack & Conventions (monorepo)

| Category | Technology | Notes |
|----------|-----------|-------|
| Languages | TypeScript, DAML, Bash | TypeScript across the JS subprojects; DAML in `dapp/daml/`; Bash for canton-barebones scripts |
| Package manager | npm workspaces | Single root `package-lock.json`; one root `npm install` links every workspace. Root `package.json` orchestrates scripts via `npm --prefix <dir>` |
| Node | 24 | Pinned via root `.nvmrc`; inherits to every Node subproject |
| Container runtime | Docker | Used by `canton-barebones/` for the local participant + Postgres |
| Commit linting | commitlint + husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config |
| Pre-commit | lint-staged | Root `.lintstagedrc.mjs` runs root Biome (`biome check --write`) across `carpincho-wallet/`, `canton-connect-kit/`, `dapp/frontend/`, and `dapp/e2e/` |
| Pre-push | tsc | Root `.husky/pre-push` runs `tsc --noEmit` per Node subproject |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`canton-barebones/`](canton-barebones/) | Local Canton participant + Postgres via docker-compose; deploy + health + token scripts | Docker, Bash, Node scripts | 3013/3014/3015/3016/3017/3018 |
| [`dapp/daml/`](dapp/daml/) | `quickstart-tally` DAML model | DAML | n/a (DAR artifact) |
| [`canton-barebones/wallet-service/`](canton-barebones/wallet-service/) | JSON-RPC bridge between the wallet and the Canton participant. Started by `npm run canton:up`. Self-mints its Canton JWT. | Node + Express + TypeScript | 3010 |
| [`carpincho-wallet/`](carpincho-wallet/) | CIP-0103 wallet — vault, signing, WalletConnect, Chrome extension | Vite 6 + React 18 + Tailwind v4 + Biome | 3011 |
| [`dapp/frontend/`](dapp/frontend/) | dApp UI | Vite + React + Tailwind v4 + Radix UI + Biome | 3012 |
| [`dapp/e2e/`](dapp/e2e/) | dApp integration tests | Playwright + TypeScript | n/a |
| [`canton-connect-kit/`](canton-connect-kit/) | wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets | TypeScript + React 18 + Biome | n/a (library) |

## Code Style

- All source code in English regardless of conversation language.
- TypeScript preferred over JavaScript across Node subprojects.
- **No semicolons** in TypeScript / JavaScript across the repo.
- **Comments are terse and explain *why*, not *what*.** Prefer one line. Do not restate what the code already says, narrate steps, or write multi-line prose where a short clause suffices. If the code needs a paragraph to be understood, simplify the code instead.
- Lint and formatting are centralized in the root `biome.json`. Add project-specific rules under `overrides` keyed by path; do not create per-subproject Biome configs.

## Working Rules

- Use **npm** only (never pnpm or yarn).
- This is an npm workspaces monorepo: one `npm install` from the repo root installs and links every package. There is no per-package install step.
- Run a subproject script either by `cd <subproject>` or by using `npm --prefix <subproject> run <script>`. The root `package.json` exposes orchestration shortcuts:
  - `npm run canton:up` / `canton:down` / `canton:health` / `canton:token`
  - `npm run build-dar -- <daml-project>` / `npm run deploy-dar -- <dar>`
  - `npm run carpincho:build:extension`
  - `npm run app:dev`
- Local ports are intentionally assigned in the `3010+` range (see table above). Do not change them without updating every subproject's defaults.
- Treat the single root `package-lock.json` as authoritative. Do not regenerate it as part of unrelated changes, and do not reintroduce per-package lockfiles.
- The root `package.json` pins `@canton-network/dapp-sdk` to `1.1.0` via `overrides`: consumers declare `^1.1.0`, but `1.2.0` is intentionally held back. npm 11 does not persist `overrides` into `package-lock.json`, so the pin is enforced by the override on every relock and by the resolved `1.1.0` entry in the lock on every plain install. Do not bump it without testing the dApp flow against the newer SDK.
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `npm --prefix`:
  - `carpincho-wallet`: `npm test` (Node `node:test` + `tsx` + happy-dom)
  - `dapp/frontend`: `npm test` (Node `node:test` with `--experimental-strip-types`)
  - `dapp/e2e`: `npm test` (Playwright against the running local stack)
  - `canton-barebones`: `npm test` (Node `node:test` against the scripts)
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

- Subproject-level: `npm run lint` and `npm test` inside any subproject you touched.
- Root-level: `git push --dry-run` exercises the pre-push tsc sweep across all Node subprojects.
- For the full end-to-end loop (Canton up → DAR built → DAR deployed → wallet-service → wallet → dApp), follow [`README.md`](README.md) §1–6.

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 Canton wallet provider spec](https://github.com/digital-asset/canton/tree/main/community/app/src/pack/examples/04-canton-wallet)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
