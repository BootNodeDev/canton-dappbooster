import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { readManifests } from './manifests.mjs'

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
