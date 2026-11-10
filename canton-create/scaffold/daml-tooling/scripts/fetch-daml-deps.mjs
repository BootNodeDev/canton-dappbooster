#!/usr/bin/env node
//
// Fetches the Splice DARs `daml/daml.yaml` data-depends on into its gitignored deps/, so the Daml
// source is what this project carries and the artifacts are not. A model with no Splice
// dependency lists none, and this is then a no-op.
//
// The version is not a choice: an Amulet-moving choice is exercised against the AmuletRules the
// network runs, so a DAR its package config governs is built at the version that config names,
// which only a DSO vote moves. SPLICE_TAG names the release of a network of your own, taken at
// its newest. With the local stack installed, the release is the canton-barebones template's and
// the versions are the ones the LocalNet's Scan reports, so a ledger upgraded in place keeps
// building against the Amulet it still runs.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

// CANTON_APP_DIR points the script at another app, which is how the monorepo runs it on its example.
const APP_DIR = path.resolve(process.env.CANTON_APP_DIR ?? path.join(import.meta.dirname, '..'))
const ENV_FILE = path.join(APP_DIR, '.env')
const DAML_DIR = path.join(APP_DIR, 'daml')
const LOCALNET_TEMPLATE = '@bootnodedev/canton-barebones/templates/canton-barebones.config.json'
const LOCALNET_SCAN_API = 'http://scan.localhost:4000/api/scan'
const DEPS_DIR = path.join(DAML_DIR, 'deps')
const STAMP = path.join(DEPS_DIR, '.splice-tag')

// The package config field that names each governed DAR's version.
const GOVERNED = {
  'splice-amulet': 'amulet',
  'splice-amulet-name-service': 'amuletNameService',
  'splice-dso-governance': 'dsoGovernance',
  'splice-validator-lifecycle': 'validatorLifecycle',
  'splice-wallet': 'wallet',
  'splice-wallet-payments': 'walletPayments',
}

// Anonymous read of a public upstream, so https rather than ssh: a developer without a
// GitHub key still has to be able to build.
const SPLICE_REPO = 'https://github.com/canton-network/splice.git'

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] })

// daml.yaml is where dpm reads the dependency list, so it is the one place it is spelled; each
// name is also the version-less filename the copy below lands on.
export const targets = (damlDir = DAML_DIR) =>
  fs
    .readFileSync(path.join(damlDir, 'daml.yaml'), 'utf8')
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

// A governed DAR at the network's version; any other, or any without a network, at the newest.
export const pick = (names, target, packageConfig) => {
  const field = GOVERNED[target]
  if (packageConfig === undefined || field === undefined) {
    return newest(names, target)
  }
  return `${target}-${packageConfig[field]}.dar`
}

// undefined when no LocalNet answers, which leaves every DAR at the release's newest.
const localnetPackageConfig = async () => {
  try {
    const response = await fetch(`${LOCALNET_SCAN_API}/v0/dso`, {
      signal: AbortSignal.timeout(15_000),
    })
    const dso = response.ok ? await response.json() : undefined
    // Splice reads only the schedule's initial value; its future values are no longer used.
    return dso?.amulet_rules?.contract?.payload?.configSchedule?.initialValue?.packageConfig
  } catch {
    return undefined
  }
}

const resolveRelease = () => {
  if (fs.existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }
  if (process.env.SPLICE_TAG) {
    return { localnet: false, tag: process.env.SPLICE_TAG }
  }
  let template
  try {
    template = createRequire(import.meta.url).resolve(LOCALNET_TEMPLATE)
  } catch {
    throw new Error(
      'daml/daml.yaml depends on Splice DARs: set SPLICE_TAG in .env to the Splice release your network runs, e.g. 0.8.1',
    )
  }
  const tag = JSON.parse(fs.readFileSync(template, 'utf8')).splice?.tag
  if (typeof tag !== 'string' || tag === '') {
    throw new Error(`no splice.tag in ${template}`)
  }
  return { localnet: true, tag }
}

const main = async () => {
  const wanted = targets()
  if (wanted.length === 0) {
    return
  }

  const { localnet, tag } = resolveRelease()
  const packageConfig = localnet ? await localnetPackageConfig() : undefined
  if (localnet && packageConfig === undefined) {
    console.log(
      `fetch-daml-deps: no LocalNet Scan answered, so this builds on Splice ${tag}'s newest DARs`,
    )
  }
  // A vote moves the network's versions without moving the tag, so the stamp holds both.
  const stamp = `${tag} ${JSON.stringify(packageConfig ?? null)}`
  // Every target has to be on disk too, not just the right tag: adding a data-dependency moves
  // daml.yaml without moving the tag, and a stamp alone would skip the fetch and leave `dpm build`
  // to fail on a DAR nobody fetched.
  const fetched =
    fs.existsSync(STAMP) &&
    fs.readFileSync(STAMP, 'utf8').trim() === stamp &&
    wanted.every((target) => fs.existsSync(path.join(DEPS_DIR, `${target}.dar`)))
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
    const picked = wanted.map((target) => {
      const name = pick(names, target, packageConfig)
      if (name === undefined || !names.includes(name)) {
        throw new Error(`Splice ${tag} ships no ${name ?? `${target} DAR`}`)
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
    fs.writeFileSync(STAMP, `${stamp}\n`)
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true })
  }
}

// argv[1] keeps a symlink that import.meta.filename resolves, so compare real paths.
if (fs.realpathSync(process.argv[1]) === import.meta.filename) {
  await main()
}
