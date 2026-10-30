import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { libraryNames, readManifests } from './manifests.mjs'

const NPM_PAGE_FIELDS = [
  'description',
  'keywords',
  'homepage',
  'bugs',
  'author',
  'license',
  'repository',
]

const isBlank = (value) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

describe('readManifests', () => {
  it('reads every package pnpm finds in the workspace', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifests-'))
    after(() => fs.rmSync(root, { recursive: true, force: true }))
    fs.mkdirSync(path.join(root, 'example-dapps/probe'), { recursive: true })
    fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - example-dapps/*\n')
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"root","private":true}')
    fs.writeFileSync(
      path.join(root, 'example-dapps/probe/package.json'),
      '{"name":"probe","version":"0.1.0"}',
    )

    assert.deepEqual(Object.keys(readManifests(root)).sort(), [
      'example-dapps/probe/package.json',
      'package.json',
    ])
  })
})

describe('published manifests', () => {
  it('fill every field their npm page shows', () => {
    const manifests = readManifests()
    const published = libraryNames(manifests)

    const missing = Object.values(manifests)
      .filter((manifest) => published.has(manifest.name))
      .flatMap((manifest) =>
        NPM_PAGE_FIELDS.filter((field) => isBlank(manifest[field])).map(
          (field) => `${manifest.name}: ${field}`,
        ),
      )

    assert.deepEqual(missing, [])
  })
})
