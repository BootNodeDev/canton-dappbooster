#!/usr/bin/env node
//
// Builds daml/ on the pinned Daml SDK, else on the newest installed patch of the pin's minor line.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DAML_DIR = path.resolve(import.meta.dirname, '..', 'daml')
const DPM_INSTALL_DOCS = 'https://docs.canton.network/sdks-tools/cli-tools/dpm#installation'

export const sdkVersionOf = (damlYaml) =>
  damlYaml.match(/^sdk-version:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/m)?.[1]

export const pinnedSdk = () =>
  sdkVersionOf(fs.readFileSync(path.join(DAML_DIR, 'daml.yaml'), 'utf8'))

// dpm takes a package, a project or an SDK from these, so an inherited one points it somewhere else.
const PACKAGE_CONTEXT = [
  'DAML_PACKAGE',
  'DAML_PROJECT',
  'DPM_ASSEMBLY',
  'DPM_LOCKFILE_ENABLED',
  'DPM_MULTI_PACKAGE',
  'DPM_RESOLUTION_FILE',
  'DPM_SDK_VERSION',
]

export const withoutPackageContext = (env) =>
  Object.fromEntries(Object.entries(env).filter(([name]) => !PACKAGE_CONTEXT.includes(name)))

export const installedSdks = (entries) =>
  entries
    .filter((entry) => entry.installed === true && /^\d+\.\d+\.\d+$/.test(entry.version))
    .map((entry) => entry.version)

const parsedListing = (output) => {
  try {
    return JSON.parse(output)
  } catch {
    return undefined
  }
}

const minorLine = (version) => version.split('.').slice(0, 2).join('.')

export const chooseSdk = (installed, pin) => {
  // The pin first, so a rebuild after `dpm install <pin>` lands on it instead of the patch that failed.
  if (installed.includes(pin)) {
    return pin
  }

  return installed
    .filter((version) => minorLine(version) === minorLine(pin))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1)
}

const PREFIX = 'build-dar: '

// Bold red on a terminal only, like dev-stack.sh's `[x]`, so piped output stays plain.
const errorPrefix = () =>
  process.stderr.isTTY ? `\u001b[1;31m${PREFIX.trimEnd()}\u001b[0m ` : PREFIX

const fail = (...lines) => {
  console.error(errorPrefix() + lines.join(`\n${' '.repeat(PREFIX.length)}`))
  process.exit(1)
}

const main = () => {
  const pin = pinnedSdk()
  if (pin === undefined) {
    fail('no sdk-version in daml/daml.yaml.')
  }

  const listing = spawnSync('dpm', ['version', '--output', 'json'], {
    cwd: '/', // always exists, and no daml.yaml above it gives dpm a package context
    encoding: 'utf8',
    env: withoutPackageContext(process.env),
  })
  if (listing.error?.code === 'ENOENT') {
    fail(
      'dpm not found on PATH.',
      `Install it and add ~/.dpm/bin to your PATH: ${DPM_INSTALL_DOCS}`,
    )
  }
  if (listing.error !== undefined) {
    fail(`dpm could not run: ${listing.error.code}.`, `Reinstall it: ${DPM_INSTALL_DOCS}`)
  }
  if (listing.status !== 0) {
    fail('`dpm version` failed:', ...(listing.stderr || listing.stdout).trim().split('\n'))
  }

  const entries = parsedListing(listing.stdout)
  if (!Array.isArray(entries)) {
    fail('could not read the SDK list from `dpm version --output json`.')
  }

  const sdk = chooseSdk(installedSdks(entries), pin)
  if (sdk === undefined) {
    fail(`no Daml SDK ${minorLine(pin)} installed.`, `Install the tested one: dpm install ${pin}`)
  }

  console.log(`${PREFIX}building on Daml SDK ${sdk}`)
  const build = spawnSync('dpm', ['build'], {
    cwd: DAML_DIR,
    stdio: 'inherit',
    env: {
      ...withoutPackageContext(process.env),
      DAML_PACKAGE: DAML_DIR,
      DPM_SDK_VERSION: sdk, // undocumented: overrides daml.yaml's sdk-version for this build only
      LANG: 'C.UTF-8',
    },
  })
  if (build.status === 0) {
    return
  }

  if (sdk === pin) {
    fail(`the build failed on Daml SDK ${sdk}.`)
  }
  fail(`the build failed on Daml SDK ${sdk}.`, `It is tested on ${pin}: dpm install ${pin}`)
}

// `import.meta.filename` rather than a `file://` template around argv[1], as in fetch-daml-deps.mjs.
if (import.meta.filename === process.argv[1]) {
  main()
}
