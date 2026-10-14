// The release script and the version gate need the same view of the workspace: every manifest, and
// which of them are the published libraries.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './gate.mjs'

export const ROOT_MANIFEST = 'package.json'

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

// pnpm's own list, so nothing `pnpm -r publish` publishes is missing from the bump or the check.
const workspaceDirs = (root) =>
  JSON.parse(
    execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8' }),
  ).map((workspace) => workspace.path)

/** Every workspace manifest, parsed, keyed by its repo-relative path. */
export const readManifests = (root = repoRoot) => {
  // pnpm reports real paths, even for a root reached through a symlink.
  const base = fs.realpathSync(root)
  return Object.fromEntries(
    workspaceDirs(root).map((dir) => [
      path.join(path.relative(base, dir), 'package.json'),
      JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')),
    ]),
  )
}

/**
 * The published packages, by package name. A workspace manifest is one unless it is private,
 * which is what leaves the root and the `canton-create/scaffold/` folders out of the lockstep.
 */
export const libraryNames = (manifests) =>
  new Set(
    Object.values(manifests)
      .filter((manifest) => manifest.private !== true && typeof manifest.name === 'string')
      .map((manifest) => manifest.name),
  )
