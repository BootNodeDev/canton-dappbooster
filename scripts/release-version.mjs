#!/usr/bin/env node
//
// Bumps the lockstep version, rewrites every range that points at a library, then commits, tags,
// pushes and opens a *draft* GitHub release. Publishing that draft is the one irreversible step and
// stays a human click: .github/workflows/release.yml runs on `release: published`.
//
// Usage: node scripts/release-version.mjs 0.4.0
//
// Spell the version as a plain argument. `pnpm run release:version -- 0.4.0` forwards the separator
// into argv, so the version arrives as `--` (the deploy-dar note in CLAUDE.md); that is rejected
// here rather than half-applied.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './lib/gate.mjs'
import { DEPENDENCY_FIELDS, libraryNames, ROOT_MANIFEST, readManifests } from './lib/manifests.mjs'

// semver.org's own regex, minus the named groups: a build-metadata or prerelease version has to
// survive this, and a `v` prefix, a range or a `--` must not.
const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/

export const parseVersion = (argument) => {
  if (typeof argument !== 'string' || !SEMVER.test(argument)) {
    throw new Error(
      `not a version: ${argument ?? '(none)'}. Usage: node scripts/release-version.mjs 0.4.0`,
    )
  }
  return argument
}

export const isPrerelease = (version) => version.includes('-')

/**
 * Writes the version into the root manifest and every published library, and rewrites every range
 * pointing at one of those libraries to `^<version>`. Pure: it returns copies.
 *
 * The same string goes into both halves, which is what keeps the local folders linked through a
 * prerelease too — `^0.4.0-rc.0` does satisfy `0.4.0-rc.0`.
 */
export const rewriteManifests = (manifests, version) => {
  const libraries = libraryNames(manifests)
  const next = {}

  for (const [file, manifest] of Object.entries(manifests)) {
    const copy = structuredClone(manifest)
    if (file === ROOT_MANIFEST || libraries.has(copy.name)) {
      copy.version = version
    }
    for (const field of DEPENDENCY_FIELDS) {
      for (const name of Object.keys(copy[field] ?? {})) {
        if (libraries.has(name)) {
          copy[field][name] = `^${version}`
        }
      }
    }
    next[file] = copy
  }

  return next
}

const serialize = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`

const writeManifests = (manifests, next) => {
  const written = []
  for (const [file, manifest] of Object.entries(next)) {
    const text = serialize(manifest)
    if (text === serialize(manifests[file])) {
      continue
    }
    fs.writeFileSync(path.join(repoRoot, file), text)
    written.push(file)
  }
  return written
}

const run = (command, args) => {
  try {
    return execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' })
  } catch (error) {
    const detail = `${error.stderr ?? ''}${error.stdout ?? ''}`.trim()
    throw new Error(`${command} ${args.join(' ')} failed${detail === '' ? '' : `:\n${detail}`}`)
  }
}

const step = (command, args) => {
  process.stdout.write(`release-version: ${command} ${args.join(' ')}\n`)
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' })
}

const tagExists = (tag) => {
  try {
    run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`])
    return true
  } catch {
    return false
  }
}

const main = () => {
  const version = parseVersion(process.argv[2])
  const tag = `v${version}`

  if (run('git', ['status', '--porcelain']).trim() !== '') {
    throw new Error('the working tree is dirty. Commit or stash first.')
  }
  if (tagExists(tag)) {
    throw new Error(`tag ${tag} already exists.`)
  }

  const manifests = readManifests()
  const written = writeManifests(manifests, rewriteManifests(manifests, version))
  if (written.length === 0) {
    throw new Error(`every manifest is already on ${version}. Nothing to bump.`)
  }
  process.stdout.write(`release-version: ${version} into ${written.join(', ')}\n`)

  step('pnpm', ['install'])
  step('git', ['add', ...written, 'pnpm-lock.yaml'])
  step('git', ['commit', '-m', `release: ${tag}`])

  // Tag only once the branch push is in, so a rejected push leaves nothing to unwind by hand.
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  step('git', ['push', 'origin', branch])
  step('git', ['tag', tag])
  step('git', ['push', 'origin', tag])

  step('gh', [
    'release',
    'create',
    tag,
    '--draft',
    '--generate-notes',
    ...(isPrerelease(version) ? ['--prerelease'] : []),
  ])

  process.stdout.write(`release-version: ${tag} is a draft release. Publish it to release.\n`)
}

// `import.meta.filename`, not a `file://` template around argv[1]: the two disagree the moment the
// repo path holds a space, and then the whole bump silently no-ops.
if (import.meta.filename === process.argv[1]) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`release-version: ${error.message}\n`)
    process.exit(1)
  }
}
