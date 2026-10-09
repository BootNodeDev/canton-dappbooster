# create-canton-dappbooster

Scaffolds a Canton dApp.

```bash
npm create canton-dappbooster my-app
# or
pnpm create canton-dappbooster my-app --example amulet-vesting --localnet
```

npm needs `--` before the flags (`npm create canton-dappbooster my-app -- --localnet`); pnpm
must not get one, because it passes the `--` through and the flags after it are read as folder names.
`--help` lists every flag.

## What a run does

It asks for the folder, the app and the local network when the command line leaves them out (without
a terminal it asks nothing: the folder is required and the rest default to the starter without a
local network), copies the app, creates `.env` from `.env.example`, installs the packages with the
manager that ran it, and makes a git repository with a first commit, as create-next-app does:
skipped when the folder is already inside a repository, or with `--disable-git`. It ends with the
next steps. If a step fails, it removes what it wrote.

## What it makes

The app is the starter: a React + Vite app on `@bootnodedev/canton-connect`,
`@bootnodedev/canton-dappbooster` and `@bootnodedev/canton-theme`, with a mock wallet so it connects
before a real one is installed, and a sample DAML contract in `daml/`. An app with a contract also
gets the scripts that build and deploy it. `--localnet` adds a local Canton stack:
`@bootnodedev/canton-barebones` for the LocalNet, the Splice Wallet Gateway, and
`scripts/dev-stack.sh` to drive them.

`--example <name>` starts from an example instead, a complete app published as
`@bootnodedev/canton-example-<name>`; the package itself is the app, and the contract scripts and
the local network go on top of it the same way. A copy already installed where the CLI runs is used
first, which is how `try` tests an unpublished one. Any spec npm can pack works too.

## How it is built

The screen is [Ink](https://github.com/vadimdemedes/ink) (React for the terminal). `tsdown` bundles
it, React included, into `dist/index.js`, so they are `devDependencies` and the published package
has no dependencies to install.

## How the scaffold is built

`scaffold/` holds everything the CLI copies into a new project, in this order:

- `starter/`: the app, a complete project
- `daml-tooling/`: `build-dar`, `deploy-dar` and `fetch-daml-deps`, added when the app has `daml/daml.yaml`
- `localnet/`: the local network stack, added with `--localnet` or the checkbox

Each is a workspace package, so the monorepo typechecks them against the libraries' source; their
`^<version>` ranges link the local folders here and install from npm in a scaffolded project, the
same way `example-dapps/amulet-vesting` does. The tarball ships `scaffold/` as it is, minus what
`files` excludes, so a range there is never rewritten and must never be `workspace:`.

`daml-tooling/` and `localnet/` may add files and merge `scripts`, `dependencies` and
`devDependencies` into the app's manifest. `.gitignore` and `README.md` are appended to, and
`.env.example` gets each block whose keys are not already set. Anything else either would overwrite
is a conflict, and `scaffold` throws rather than pick a winner. `_gitignore` is renamed back to
`.gitignore` on the way, because npm would otherwise drop it from the tarball.
