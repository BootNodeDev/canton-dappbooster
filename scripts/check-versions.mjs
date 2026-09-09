#!/usr/bin/env node
// The ranges are the link. pnpm links a library's folder only while that folder's own `version`
// satisfies the range a consumer declares, and downloads the published copy when it does not — with
// no warning, so local edits simply stop having any effect. Nothing else notices, which is why this
// exists: it fails when a declared range is not `^<the local folder's version>`.
//
// Given a version argument it also requires the root and every library to be on it, which is how
// .github/workflows/release.yml refuses a release whose tag and manifests disagree.
//
// Usage: node scripts/check-versions.mjs [expected-version]

import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createGate, repoRoot } from './lib/gate.mjs'
import { DEPENDENCY_FIELDS, libraryNames, ROOT_MANIFEST, readManifests } from './lib/manifests.mjs'

const { report, finish } = createGate('check-versions')

// The gate's contract is `file:line message`, and JSON.parse keeps no positions, so the line comes
// from a second read through typescript's JSON parser.
const lineOf = (file, keyPath) => {
  const source = ts.parseJsonText(file, readFileSync(path.join(repoRoot, file), 'utf8'))
  let node = source.statements[0]?.expression
  let position = node?.getStart(source) ?? 0

  for (const key of keyPath) {
    if (node === undefined || !ts.isObjectLiteralExpression(node)) break
    const property = node.properties.find(
      (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.text === key,
    )
    if (property === undefined) break
    position = property.getStart(source)
    node = property.initializer
  }

  return source.getLineAndCharacterOfPosition(position).line + 1
}

const expected = process.argv[2]
const manifests = readManifests()
const libraries = libraryNames(manifests)

const versionOf = new Map(
  Object.entries(manifests)
    .filter(([, manifest]) => libraries.has(manifest.name))
    .map(([file, manifest]) => [manifest.name, { file, version: manifest.version }]),
)

let ranges = 0
for (const [file, manifest] of Object.entries(manifests)) {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      const local = versionOf.get(name)
      if (local === undefined) continue
      ranges += 1
      if (range === `^${local.version}`) continue
      report(
        path.join(repoRoot, file),
        lineOf(file, [field, name]),
        `${name} is declared ${range} but ${local.file} is ${local.version}, so pnpm installs the published copy instead of linking the folder`,
      )
    }
  }
}

const lockstep = [ROOT_MANIFEST, ...[...versionOf.values()].map((local) => local.file)]
if (expected !== undefined) {
  for (const file of lockstep) {
    if (manifests[file].version === expected) continue
    report(
      path.join(repoRoot, file),
      lineOf(file, ['version']),
      `version is ${manifests[file].version} but the release asks for ${expected}`,
    )
  }
}

finish(`${lockstep.length} versions, ${ranges} ranges, in step`)
