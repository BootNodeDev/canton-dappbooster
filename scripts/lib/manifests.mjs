// The release script and the version gate need the same view of the workspace: every manifest, and
// which of them are the published libraries. Deriving both here is what keeps a new library or a
// new consumer of one from needing an edit in either.

import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from './gate.mjs'

export const ROOT_MANIFEST = 'package.json'

// Two levels, which is every entry in pnpm-workspace.yaml's `packages` (canton-*, dapp/*); reading
// that file needs a YAML parser no script here has, and a `**` glob would sweep in the package.json
// files under `.canton-localnet/`. A workspace package deeper than two levels is invisible here.
const PATTERNS = [ROOT_MANIFEST, '*/package.json', '*/*/package.json']

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

/** Every workspace manifest, parsed, keyed by its repo-relative path. */
export const readManifests = () =>
  Object.fromEntries(
    fs
      .globSync(PATTERNS, { cwd: repoRoot, exclude: (entry) => entry.includes('node_modules') })
      .sort()
      .map((file) => [file, JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'))]),
  )

/**
 * The published libraries, by package name. A workspace manifest is one unless it is private,
 * which is what leaves the root, `dapp/frontend` and `dapp/daml` out of the lockstep.
 */
export const libraryNames = (manifests) =>
  new Set(
    Object.values(manifests)
      .filter((manifest) => manifest.private !== true && typeof manifest.name === 'string')
      .map((manifest) => manifest.name),
  )
