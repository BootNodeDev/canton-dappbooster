import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newest, targets } from './fetch-daml-deps.mjs'

// The names a Splice release actually ships in daml/dars, trimmed to the interesting neighbours:
// two Amulet versions whose ordering a string sort gets wrong, and a longer name that starts with
// one of the targets.
const RELEASE = [
  'splice-amulet-0.1.9.dar',
  'splice-amulet-0.1.21.dar',
  'splice-amulet-name-service-0.1.21.dar',
  'splice-api-token-holding-v1-1.0.0.dar',
  'splice-util-0.1.7.dar',
]

describe('Splice DAR selection', () => {
  it('takes the highest version rather than the highest string', () => {
    assert.equal(newest(RELEASE, 'splice-amulet'), 'splice-amulet-0.1.21.dar')
  })

  it('does not answer for a longer name that starts with the target', () => {
    assert.equal(
      newest(RELEASE, 'splice-amulet-name-service'),
      'splice-amulet-name-service-0.1.21.dar',
    )
    assert.equal(newest(['splice-amulet-name-service-0.1.21.dar'], 'splice-amulet'), undefined)
  })

  it('reports nothing rather than guessing when the release ships no such DAR', () => {
    assert.equal(newest(RELEASE, 'splice-api-token-metadata-v1'), undefined)
  })
})

describe('daml.yaml data-dependencies', () => {
  // Read from the real daml.yaml, not a fixture: a dependency added there without a matching fetch
  // is exactly the drift this reading exists to prevent, and a fixture would hide it.
  it('names every deps/ DAR the package declares, and nothing else', () => {
    assert.deepEqual(targets(), [
      'splice-amulet',
      'splice-api-token-holding-v1',
      'splice-api-token-metadata-v1',
      'splice-api-token-transfer-instruction-v1',
    ])
  })
})
