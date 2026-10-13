import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findDrift } from './check-versions.mjs'
import { readManifests } from './manifests.mjs'

// A test rather than a second command in the root `test` script, which would name a file a consumer
// scaffold deletes. See the `kit/` section of root CLAUDE.md.
const manifests = readManifests()

describe('version lockstep', () => {
  it('every declared range points at the local folder version', () => {
    const { findings, ranges } = findDrift(manifests)

    assert.deepEqual(findings, [])
    assert.ok(ranges > 0)
  })

  it('refuses a release version the manifests do not carry', () => {
    const { findings } = findDrift(manifests, '99.0.0')

    assert.match(findings.at(0)?.message ?? '', /the release asks for 99\.0\.0/)
  })
})
