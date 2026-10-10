import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyRequiredFlags, needsRescaffold } from './localnet-config.mjs'

const template = {
  version: 1,
  splice: { repo: 'canton-network/splice', tag: '0.6.11' },
  validators: { appUser: { enabled: true, ui: false } },
  sv: { scanUI: false, svUI: false },
}

describe('LocalNet config scaffolding', () => {
  it('keeps a config that matches the template version and Splice tag', () => {
    // Scenario: a developer turned swaggerUI on to debug. Nothing about the template
    // moved, so their copy is theirs to keep.
    const local = structuredClone(template)
    local.networkTools = { swaggerUI: true }

    assert.equal(needsRescaffold(local, template), undefined)
  })

  it('re-scaffolds when the template moves past the local copy', () => {
    assert.equal(needsRescaffold(undefined, template), 'missing')
    assert.match(needsRescaffold({ ...template, version: 0 }, template), /config version 0 -> 1/)
    assert.match(
      needsRescaffold({ ...template, splice: { tag: '0.6.10' } }, template),
      /Splice tag 0\.6\.10 -> 0\.6\.11/,
    )
  })

  it('turns on the flags nginx needs for /api/validator and /api/scan', () => {
    const config = structuredClone(template)

    assert.equal(applyRequiredFlags(config), true)
    assert.equal(config.validators.appUser.ui, true)
    assert.equal(config.sv.scanUI, true)
    // Untouched: the flags are a floor, not the whole config.
    assert.equal(config.sv.svUI, false)
    assert.equal(applyRequiredFlags(config), false)
  })

  it('refuses a config shape the flags no longer fit', () => {
    // A silently skipped flag is the failure this whole script exists to stop.
    assert.throws(() => applyRequiredFlags({ ...template, sv: {} }), /sv\.scanUI is not in the/)
  })
})
