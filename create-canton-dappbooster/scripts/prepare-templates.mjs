#!/usr/bin/env node
//
// Copies ../templates into ./templates, which is what the CLI reads and what `files` ships. The
// copy is also where `workspace:` ranges become real ones, with the meaning pnpm gives them at
// publish: `workspace:*` is the exact version, `workspace:^` and `workspace:~` the matching range.
// A range resolves against whichever workspace package carries the name, as pnpm does, so a new
// library needs no edit here.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const source = path.join(root, 'templates')
const target = path.resolve(import.meta.dirname, '..', 'templates')

const SKIP = new Set(['node_modules', 'dist', '.daml', 'deps'])

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

const workspaceVersions = () =>
  new Map(
    fs
      .globSync(['*/package.json', '*/*/package.json'], {
        cwd: root,
        exclude: (entry) => entry.includes('node_modules'),
      })
      .map((file) => readJson(path.join(root, file)))
      .filter((manifest) => typeof manifest.name === 'string')
      .map((manifest) => [manifest.name, manifest.version]),
  )

const WORKSPACE_RANGE = /^workspace:([*^~])$/

export const resolveWorkspaceRanges = (manifest, versions) => {
  const resolved = structuredClone(manifest)
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const [name, range] of Object.entries(resolved[field] ?? {})) {
      const match = WORKSPACE_RANGE.exec(range)
      if (match === null) {
        continue
      }
      const version = versions.get(name)
      if (version === undefined) {
        throw new Error(`${name} is ${range} but no workspace library carries that name`)
      }
      const prefix = match[1] === '*' ? '' : match[1]
      resolved[field][name] = `${prefix}${version}`
    }
  }
  return resolved
}

const copy = (from, to, versions) => {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) {
      continue
    }
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copy(src, dest, versions)
    } else if (entry.name === 'package.json') {
      const manifest = resolveWorkspaceRanges(readJson(src), versions)
      fs.writeFileSync(dest, `${JSON.stringify(manifest, null, 2)}\n`)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

const main = () => {
  const versions = workspaceVersions()
  fs.rmSync(target, { recursive: true, force: true })
  copy(source, target, versions)
  const names = fs.readdirSync(target).join(', ')
  console.log(`prepare-templates: ${names} -> ${path.relative(root, target)}`)
}

if (import.meta.filename === process.argv[1]) {
  main()
}
