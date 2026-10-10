# Agent configuration: `canton-create`

This file applies only to `canton-create/`, the `create-canton-dappbooster` package. For
monorepo-wide rules see [`../CLAUDE.md`](../CLAUDE.md). For how a run and the scaffold layers fit
together, see [`architecture.md`](architecture.md).

## Every option is a flag

- An agent runs the installer without a terminal, so it can only pass flags. Every question the
  wizard asks gets a flag in the same change. The `USAGE` text in `src/index.tsx` and the flag table
  in the README both list it.
- Without a terminal the installer asks nothing, so every question also needs a default.
- A flag that would only repeat a default does not exist, so there is no `--app` and no `--yes`.

## Scaffold rules

- Each app owns its contract. `scaffold/daml-tooling/` holds no Daml, only the scripts that build
  and deploy whatever `daml/daml.yaml` the app carries.
- A layer may add files and merge `scripts`, `dependencies` and `devDependencies` into the app's
  manifest. It never redefines a key an earlier layer set. `scaffold` appends to `.gitignore` and
  `README.md`, and merges `.env.example` by key, leaving out a block whose keys the file already
  sets. Any other overwrite is a design error in `scaffold/`, and `scaffold` throws
  `ScaffoldConflictError`.
- A layer's `README.md` is a section that gets appended, so it starts with a `##` heading and never
  with a title.
- The root range rule has no exception in `scaffold/`: the tarball ships the folders as they are, so
  nothing rewrites a `workspace:` range on the way out.
- A file that has to land as `.gitignore` or `pnpm-workspace.yaml` lives here as `_gitignore` or
  `_pnpm-workspace.yaml`, and `scaffold` renames it back. npm drops a `.gitignore` from every
  tarball, and a `pnpm-workspace.yaml` inside the monorepo makes pnpm treat the folder as a
  workspace root of its own.
- The monorepo runs the `daml-tooling/` and `localnet/` scripts on `example-dapps/amulet-vesting`
  instead of keeping copies. Each script finds the app's `daml/` and `.env` through
  `CANTON_APP_DIR`, which defaults to its own project. A new script reads the app from there, never
  from a path to its own folder. Their tests sit beside them, and `files` keeps the tests out
  of the tarball.
- `node dist/index.js` run from this folder is not a test of the installer. Here `scaffold/` holds
  `node_modules` and build output that `files` leaves out of the tarball, and the copy fails on
  them. Run the packed package instead: `pnpm try`, or `src/testing/packedScaffold.ts` in a test.

## Examples

An example is a complete app published on its own as `@bootnodedev/canton-example-<name>`, and the
installer never ships one inside its tarball. Adding one takes:

- the app in `example-dapps/<name>/`, with a `files` list naming what it publishes and
  `publishConfig.access: "public"`
- its name, label and hint in `EXAMPLES` in `src/apps.ts`
- its manifest in `kit/manifests.mjs`, which keeps its version in lockstep with the rest

`pnpm-workspace.yaml` already lists `example-dapps/*`.

## Dependencies

`tsdown` bundles Ink, React and every other import into `dist/index.js`, so the published package
has no dependencies to install. A new import goes in `devDependencies` for the same reason.
`react-devtools-core` is the one import left out of the bundle, because Ink only loads it when
`DEV=true`.

## Demo recording

`demo.svg` in the README is an animated SVG of a real run. Record it again after any change to the
terminal UI:

```shell
canton-create/scripts/record-demo.ts
```

The script packs the installer, runs it in a temporary directory, and overwrites `demo.svg`. The
install it starts needs network. Its comments explain the trimming and the frame merging.

- It runs on Bun, because it needs a pseudo-terminal. Node has none without `node-pty`, a native
  module, and `Bun.spawn` opens one through its `terminal` option.
- [svg-term-cli](https://github.com/marionebl/svg-term-cli) does the conversion, through `pnpm dlx`.
  It is not a dependency. `COLS` and `ROWS` set the window, so a change to either means changing
  the size of the `<img>` in the README too.

## Testing

`pnpm test` runs `vitest`, and the component tests render through `ink-testing-library`. It can drop
a key sent before the input handler mounts, so `src/components/App.test.tsx` sends each key through
`pressUntil`. The test then checks all the frames joined, because the last frame can be empty
once the app exits.
