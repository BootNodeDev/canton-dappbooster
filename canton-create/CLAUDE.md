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
- A range in a `scaffold/` manifest is `^<version>`, never `workspace:`. The tarball ships the
  folders as they are, so nothing rewrites it on the way out.
- A file that has to land as `.gitignore` or `pnpm-workspace.yaml` lives here as `_gitignore` or
  `_pnpm-workspace.yaml`, and `scaffold` renames it back. npm drops a `.gitignore` from every
  tarball, and a `pnpm-workspace.yaml` inside the monorepo makes pnpm treat the folder as a
  workspace root of its own.
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
install it starts needs network. It removes the temporary directory when it finishes.

Things worth knowing before touching it:

- It runs on Bun, because it needs a pseudo-terminal. Node has none without `node-pty`, a native
  module, and `Bun.spawn` opens one through its `terminal` option. The old installer's recorder used
  Python's `pty` for the same reason.
- It records the packed tarball, not this folder, for the reason under Scaffold rules.
- A `pnpm` shim on `PATH` answers `pnpm create canton-dappbooster` with the packed build and sets
  `npm_config_user_agent` the way `pnpm create` does. The recorded command line is the real one,
  and the installer picks pnpm for the install.
- It waits for each question to appear in the output rather than sleeping a fixed time, so a slower
  step does not break it.
- [svg-term-cli](https://github.com/marionebl/svg-term-cli) does the conversion, through `pnpm dlx`.
  It is not a dependency. `--window --width 92 --height 26 --padding 10` sets the size, and a change
  there means changing the size of the `<img>` in the README too. 26 rows fit the run down to the
  install spinner.
- The recording stops at 15 seconds, during the package install. Past that, the install prints little,
  and the animation would look frozen.
- The script merges output that arrives within 150 milliseconds into one frame, which keeps the file
  small while the spinner redraws every 80 milliseconds. Merging changes when the terminal receives
  bytes, never which bytes it receives.

## Testing

`pnpm test` runs `vitest`, and the component tests render through `ink-testing-library`. It can drop
a key sent before the input handler mounts, so `src/components/App.test.tsx` sends each key through
`pressUntil`. The test then checks all the frames joined, because the last frame can be empty
once the app exits.
