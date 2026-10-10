# Architecture: `canton-create`

`create-canton-dappbooster` copies an app and the layers it needs into a new folder. The project it
leaves installs the Canton dApp kit from npm. The rules for editing it are in [`CLAUDE.md`](CLAUDE.md).

## A run

`src/index.tsx` parses the flags and renders `App` with [Ink](https://github.com/vadimdemedes/ink),
which renders React components in the terminal. `App` asks the questions the flags left open, in
this order: the folder, the local network, the dApp. Run without an interactive terminal, it asks
nothing, and the choices take their defaults. Then it runs three sections in turn:

| Section | What it does |
|---|---|
| Scaffold | fetches the example when the dApp is not the starter, copies the app and its layers, creates `.env` from `.env.example` |
| Installation | runs `install` with the package manager named in `npm_config_user_agent`, unless `--skip-install` |
| Git | `git init` and a first commit, as create-next-app does, unless `--disable-git` |

The installer skips the Git section when git is missing or the folder is already inside a git or
Mercurial repository. Git without an `init.defaultBranch` setting gets `main`. If `init` or the
commit fails, the installer removes the new `.git` and warns, and the run still succeeds.

When a section fails, the screen shows the error, and the installer removes what it wrote. If the
run created the folder, the installer deletes it. If the folder existed and was empty, the
installer empties it again.

After the last section, `PostInstall` prints the next steps. It reads the finished project
(`readProject` in `src/projectDirectory.ts`) to name the DAR the contract builds, so the steps fit
the project the run wrote.

## Layers

`scaffold/` holds what the installer copies, and the tarball ships it as it is, minus what `files`
excludes.

| Folder | Added when | What it carries |
|---|---|---|
| `starter/` | the dApp is the starter | the complete starter app and a sample contract in `daml/` |
| `daml-tooling/` | the app has `daml/daml.yaml` | `build-dar`, `deploy-dar` and `fetch-daml-deps` |
| `localnet/` | `--localnet` or Barebones | `dev-stack.sh`, `localnet-config.mjs`, `mint-token.mjs`, `wallet-gateway.config.json`, and `canton-barebones` and the gateway in `devDependencies` |

`scaffold` in `src/scaffold.ts` copies the app first, then applies `daml-tooling/` and `localnet/`
on top of it in that order. `src/merge.ts` decides how each layer file lands: merged into the
manifest, appended, merged by key, or a conflict. `finalizeManifest` then strips what only a
published package needs (`version`, `repository`, `files`, `publishConfig` and the rest), names the
manifest after the folder and marks it private.

Each folder is a workspace package, so the monorepo checks their types against the libraries'
source. Their `^<version>` ranges link the local library folders here and install from npm in a
project.

## Examples

An example is an app published on its own, so the installer fetches it rather than ships it.
`resolveExampleSpec` in `src/example.ts` turns a bare name such as `amulet-vesting` into
`@bootnodedev/canton-example-amulet-vesting`, and passes any other spec through. `fetchExample`
then uses a copy already installed where the installer runs, which is how `pnpm try` serves an
unpublished example. Otherwise it runs `npm pack` on the spec and extracts the tarball. The
package folder is the app, and the layers go on top of it the same way they go on the starter.
