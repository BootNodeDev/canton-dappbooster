#!/usr/bin/env node
//
// Fetches the Splice DARs `dapp/daml` data-depends on into its gitignored deps/, so the Daml
// source is what this repository carries and the artifacts are not.
//
// The version is not a choice: an Amulet-moving choice is exercised against the
// AmuletRules the network is running, so the DAR has to be the one that network's Splice
// release ships. `spliceTag` reads that release off the canton-barebones template the
// LocalNet is scaffolded from, so the DAR and the LocalNet cannot disagree, and within a
// release the current Amulet is the highest version in its dars/ directory.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { repoRoot } from './lib/gate.mjs'
import { spliceTag } from './localnet-config.mjs'

const DAML_DIR = path.join(repoRoot, 'dapp/daml')
const DEPS_DIR = path.join(DAML_DIR, 'deps')
const STAMP = path.join(DEPS_DIR, '.splice-tag')

// Anonymous read of a public upstream, so https rather than ssh: a contributor without a
// GitHub key still has to be able to build.
const SPLICE_REPO = 'https://github.com/canton-network/splice.git'

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] })

// daml.yaml is where dpm reads the dependency list, so it is the one place it is spelled; each
// name is also the version-less filename the copy below lands on.
export const targets = () =>
  fs
    .readFileSync(path.join(DAML_DIR, 'daml.yaml'), 'utf8')
    .split('\n')
    .flatMap((line) => line.match(/^\s*-\s*deps\/(\S+)\.dar\s*$/)?.slice(1) ?? [])

// Which Amulet the whole DAR is built against, so it is tested rather than trusted: the version is
// anchored at both ends, or `splice-amulet-name-service` answers for `splice-amulet`, and the sort
// is numeric, or '0.1.9' wins over '0.1.21'.
export const newest = (names, target) =>
  names
    .filter((name) => new RegExp(`^${target}-[\\d.]+\\.dar$`).test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1)

const main = () => {
  const tag = spliceTag()
  // Every target has to be on disk too, not just the right tag: adding a data-dependency moves
  // daml.yaml without moving the tag, and a stamp alone would skip the fetch and leave `dpm build`
  // to fail on a DAR nobody fetched.
  const fetched =
    fs.existsSync(STAMP) &&
    fs.readFileSync(STAMP, 'utf8').trim() === tag &&
    targets().every((target) => fs.existsSync(path.join(DEPS_DIR, `${target}.dar`)))
  if (fetched) {
    return
  }

  console.log(`fetch-daml-deps: fetching Splice ${tag} DARs`)
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'splice-dars-'))
  try {
    git([
      'clone',
      '--filter=blob:none',
      '--no-checkout',
      '--depth=1',
      '--branch',
      tag,
      SPLICE_REPO,
      checkout,
    ])

    // Resolve each filename off the tree before checking anything out: a blobless clone
    // knows every name and holds no content, so a `daml/dars/*.dar` checkout would fetch the
    // release's ~150 MB of DARs to keep 3 MB of them.
    const names = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'daml/dars'], {
      cwd: checkout,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => path.basename(line.trim()))
      .filter(Boolean)
    const picked = targets().map((target) => {
      const name = newest(names, target)
      if (name === undefined) {
        throw new Error(`Splice ${tag} ships no ${target} DAR`)
      }
      return [target, name]
    })

    git(
      ['sparse-checkout', 'set', '--no-cone', ...picked.map(([, name]) => `/daml/dars/${name}`)],
      checkout,
    )
    git(['checkout'], checkout)

    fs.rmSync(DEPS_DIR, { recursive: true, force: true })
    fs.mkdirSync(DEPS_DIR, { recursive: true })
    for (const [target, name] of picked) {
      fs.copyFileSync(path.join(checkout, 'daml/dars', name), path.join(DEPS_DIR, `${target}.dar`))
      console.log(`fetch-daml-deps: ${name} -> deps/${target}.dar`)
    }
    fs.writeFileSync(STAMP, `${tag}\n`)
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true })
  }
}

// `import.meta.filename` rather than a `file://` template around argv[1]: the two disagree the
// moment the repo path holds a space, and then the fetch silently no-ops.
if (import.meta.filename === process.argv[1]) {
  main()
}
