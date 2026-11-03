import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import {
  applyRequiredFlags,
  LEDGER_ON_OLD_SPLICE,
  needsRescaffold,
  spliceMoved,
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

  it('tells a Splice release moved from a config that merely changed shape', () => {
    assert.equal(spliceMoved(undefined, template), false)
    assert.equal(spliceMoved({ ...template, version: 0 }, template), false)
    assert.equal(spliceMoved({ ...template, splice: { tag: '0.6.10' } }, template), true)
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
  const withDocker = (volumes) => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-docker-'))
    after(() => fs.rmSync(bin, { recursive: true, force: true }))
    const asked = `"volume ls --quiet --filter label=com.docker.compose.project=${installed.composeProjectName}"`
    fs.writeFileSync(
      path.join(bin, 'docker'),
      `#!/bin/sh\ncase "$*" in ${asked}) printf '%s' '${volumes}' ;; esac\n`,
      { mode: 0o755 },
    )
    return { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  }

  const scaffoldedOn = (tag) => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'localnet-'))
    after(() => fs.rmSync(target, { recursive: true, force: true }))
    const config = { ...installed, splice: { ...installed.splice, tag } }
    fs.writeFileSync(path.join(target, 'canton-barebones.config.json'), JSON.stringify(config))
    return target
  }

  const run = (target, env) =>
    spawnSync(process.execPath, [path.join(import.meta.dirname, 'localnet-config.mjs'), target], {
      env,
      encoding: 'utf8',
    })

  it('refuses to move a ledger still in Docker, and leaves its config alone', () => {
    const target = scaffoldedOn('0.0.1')

    const { status, stderr } = run(target, withDocker('canton-barebones_postgres'))

    assert.equal(status, LEDGER_ON_OLD_SPLICE)
    assert.match(stderr, /set up for Splice 0\.0\.1/)
    const config = JSON.parse(fs.readFileSync(path.join(target, 'canton-barebones.config.json')))
    assert.equal(config.splice.tag, '0.0.1')
  })

  it('exits with the status dev-stack.sh reads as the old ledger', () => {
    const devStack = fs.readFileSync(path.join(import.meta.dirname, 'dev-stack.sh'), 'utf8')

    assert.match(devStack, new RegExp(`^LEDGER_ON_OLD_SPLICE=${LEDGER_ON_OLD_SPLICE}$`, 'm'))
  })

  it('moves to the pinned Splice once no ledger is left', () => {
    const target = scaffoldedOn('0.0.1')

    const { status } = run(target, withDocker(''))

    assert.equal(status, 0)
    const config = JSON.parse(fs.readFileSync(path.join(target, 'canton-barebones.config.json')))
    assert.equal(config.splice.tag, installed.splice.tag)
  })
})
