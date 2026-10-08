// The release script and the version gate need the same view of the workspace: every manifest, and
// which of them are the published libraries.

import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from '../scripts/lib/gate.mjs'

export const ROOT_MANIFEST = 'package.json'

// Mirrors pnpm-workspace.yaml's `packages`; a package left out is never bumped or checked.
const MANIFESTS = [
  ROOT_MANIFEST,
  'canton-connect/package.json',
  'canton-dappbooster/package.json',
  'canton-theme/package.json',
  'create-canton-dappbooster/package.json',
  'create-canton-dappbooster/templates/base/package.json',
  'create-canton-dappbooster/templates/localnet/package.json',
  'dapp/daml/package.json',
  'dapp/frontend/package.json',
]

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

/** Every workspace manifest, parsed, keyed by its repo-relative path. */
export const readManifests = () =>
  Object.fromEntries(
    MANIFESTS.map((file) => [file, JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'))]),
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
