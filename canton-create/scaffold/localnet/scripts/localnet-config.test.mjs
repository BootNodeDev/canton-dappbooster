import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import {
  applyRequiredFlags,
  needsRescaffold,
  spliceUpgraded,
  UPGRADE_MARKER,
} from './localnet-config.mjs'

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

  it('counts a move to a newer Splice as an upgrade, and neither a downgrade nor a new shape', () => {
    assert.equal(spliceUpgraded(undefined, template), false)
    assert.equal(spliceUpgraded({ ...template, version: 0 }, template), false)
    assert.equal(spliceUpgraded({ ...template, splice: { tag: '0.6.9' } }, template), true)
    assert.equal(spliceUpgraded({ ...template, splice: { tag: '0.6.12' } }, template), false)
  })

  it('counts a move between tags it cannot order as an upgrade', () => {
    assert.equal(spliceUpgraded({ ...template, splice: { tag: 'main' } }, template), true)
    assert.equal(spliceUpgraded({ ...template, splice: { tag: '0.7.0-rc1' } }, template), true)
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

  it('scaffolds when run through a symlinked folder whose path holds a space', () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'localnet config '))
    after(() => fs.rmSync(work, { recursive: true, force: true }))
    const link = path.join(work, 'scripts link')
    fs.symlinkSync(import.meta.dirname, link)
    const target = path.join(work, 'localnet')

    execFileSync(process.execPath, [path.join(link, 'localnet-config.mjs'), target])

    assert.ok(fs.existsSync(path.join(target, 'canton-barebones.config.json')))
  })
})

describe('LocalNet config after a Splice bump', () => {
  const installed = JSON.parse(
    fs.readFileSync(
      createRequire(import.meta.url).resolve(
        '@bootnodedev/canton-barebones/templates/canton-barebones.config.json',
      ),
      'utf8',
    ),
  )

  // A `docker` on PATH that lists the given volumes only for this exact query, as real Docker would.
  const withDocker = (volumes, { status = 0, project = installed.composeProjectName } = {}) => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-docker-'))
    after(() => fs.rmSync(bin, { recursive: true, force: true }))
    const asked = `"volume ls --quiet --filter label=com.docker.compose.project=${project}"`
    fs.writeFileSync(
      path.join(bin, 'docker'),
      `#!/bin/sh\ncase "$*" in ${asked}) printf '%s' '${volumes}' ;; esac\nexit ${status}\n`,
      { mode: 0o755 },
    )
    return { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  }

  const scaffoldedOn = (tag, composeProjectName = installed.composeProjectName) => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'localnet-'))
    after(() => fs.rmSync(target, { recursive: true, force: true }))
    const config = { ...installed, composeProjectName, splice: { ...installed.splice, tag } }
    fs.writeFileSync(path.join(target, 'canton-barebones.config.json'), JSON.stringify(config))
    return target
  }

  const run = (target, env) =>
    spawnSync(process.execPath, [path.join(import.meta.dirname, 'localnet-config.mjs'), target], {
      env,
      encoding: 'utf8',
    })

  const configTag = (target) =>
    JSON.parse(fs.readFileSync(path.join(target, 'canton-barebones.config.json'))).splice.tag
  const hasMarker = (target) => fs.existsSync(path.join(target, UPGRADE_MARKER))

  it('moves a ledger still in Docker to the pinned Splice, and leaves the upgrade marker', () => {
    const target = scaffoldedOn('0.0.1')

    const { status } = run(target, withDocker('canton-barebones_postgres'))

    assert.equal(status, 0)
    assert.equal(configTag(target), installed.splice.tag)
    assert.ok(hasMarker(target))
  })

  it('moves to the pinned Splice with no marker once no ledger is left', () => {
    const target = scaffoldedOn('0.0.1')

    const { status } = run(target, withDocker(''))

    assert.equal(status, 0)
    assert.equal(configTag(target), installed.splice.tag)
    assert.ok(!hasMarker(target))
  })

  it('writes the marker before the move, so a failure after it keeps the marker', () => {
    const target = scaffoldedOn('0.0.1')
    fs.writeFileSync(path.join(target, 'splice-localnet-overrides.yaml'), '', { mode: 0o444 })

    const { status } = run(target, withDocker('canton-barebones_postgres'))

    assert.notEqual(status, 0)
    assert.equal(configTag(target), installed.splice.tag)
    assert.ok(hasMarker(target))
  })

  it('writes no marker when Docker reports no ledger, even if the move then fails', () => {
    const target = scaffoldedOn('0.0.1')
    fs.writeFileSync(path.join(target, 'splice-localnet-overrides.yaml'), '', { mode: 0o444 })

    const { status } = run(target, withDocker(''))

    assert.notEqual(status, 0)
    assert.equal(configTag(target), installed.splice.tag)
    assert.ok(!hasMarker(target))
  })

  it('keeps the marker, and passes, when Docker does not answer', () => {
    const target = scaffoldedOn('0.0.1')

    const { status } = run(target, withDocker('', { status: 1 }))

    assert.equal(status, 0)
    assert.ok(hasMarker(target))
  })

  it('drops the marker once the ledger it describes is gone', () => {
    const target = scaffoldedOn(installed.splice.tag)
    fs.writeFileSync(path.join(target, UPGRADE_MARKER), '')

    const { status } = run(target, withDocker(''))

    assert.equal(status, 0)
    assert.ok(!hasMarker(target))
  })

  it('asks Docker about the Compose project the config names once the run is through', () => {
    const moved = scaffoldedOn('0.0.1', 'custom')
    const kept = scaffoldedOn(installed.splice.tag, 'custom')
    fs.writeFileSync(path.join(kept, UPGRADE_MARKER), '')

    run(moved, withDocker('canton-barebones_postgres'))
    run(kept, withDocker('custom_postgres', { project: 'custom' }))

    assert.ok(hasMarker(moved))
    assert.ok(hasMarker(kept))
  })

  it('moves to an older Splice with no marker', () => {
    const target = scaffoldedOn('99.0.0')

    const { status } = run(target, withDocker('canton-barebones_postgres'))

    assert.equal(status, 0)
    assert.equal(configTag(target), installed.splice.tag)
    assert.ok(!hasMarker(target))
  })
})
