# create-canton-dappbooster

Scaffolds a Canton dApp.

```bash
npm create canton-dappbooster my-app
# or
pnpm create canton-dappbooster my-app -- --tier localnet
```

## What it makes

Two tiers, one base. The `app` tier is a React + Vite app on `@bootnodedev/canton-connect`,
`@bootnodedev/canton-dappbooster` and `@bootnodedev/canton-theme`, with a mock wallet so it connects
before a real one is installed. The `localnet` tier is the same app plus a local Canton stack:
`@bootnodedev/canton-barebones` for the LocalNet, the Splice Wallet Gateway, a DAML starter, and
`scripts/dev-stack.sh` to drive them.

`--example <name>` scaffolds a complete example instead, fetched from npm as
`@bootnodedev/canton-example-<name>`; the folder `template/` inside that package is the project.
Any spec npm can pack works too, a local directory included, which is how an example is tried
before it is published.

## How the templates are built

`templates/base` and `templates/localnet` are workspace packages, so the monorepo typechecks them
against the libraries' source; their `^<version>` ranges link the local folders here and install from
npm in a scaffolded project, the same way `dapp/frontend` does. The tarball ships `templates/` as it
is, minus what `files` excludes, so a range there is never rewritten and must never be `workspace:`.

A fragment may add files and merge `scripts`, `dependencies` and `devDependencies` into the base
manifest; `.gitignore`, `.env.example` and `README.md` are appended to. Anything else it would
overwrite is a conflict, and `scaffold` throws rather than pick a winner. The base ships
`_gitignore`, which npm would otherwise drop from the tarball, and the copy renames it back.
