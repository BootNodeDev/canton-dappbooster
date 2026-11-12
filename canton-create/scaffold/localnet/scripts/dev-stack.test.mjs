import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

const script = path.join(import.meta.dirname, 'dev-stack.sh')

describe('dev-stack.sh arguments', () => {
  it('drops the -- pnpm forwards before reading the action', () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
    after(() => fs.rmSync(app, { recursive: true, force: true }))

    const { status, stderr } = spawnSync('bash', [script, '--', 'up', '--json', '--quiet'], {
      env: { ...process.env, CANTON_APP_DIR: app },
      encoding: 'utf8',
    })

    assert.equal(status, 1)
    assert.match(stderr, /--json and --quiet cannot be combined/)
  })

  it('takes reset as an action rather than a LocalNet directory', () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
    after(() => fs.rmSync(app, { recursive: true, force: true }))

    const { status, stderr } = spawnSync('bash', [script, 'reset', '--json'], {
      env: { ...process.env, CANTON_APP_DIR: app },
      encoding: 'utf8',
    })

    assert.equal(status, 1)
    assert.match(stderr, /--json and --quiet only apply to 'up'/)
  })
})

describe('dev-stack.sh after an upgrade in place', () => {
  const executable = (file, body) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  }

  // Docker, the ports and the LocalNet tool are all doubles, so no test reaches a real stack.
  const appAfterSpliceBump = ({ contract = false } = {}) => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
    after(() => fs.rmSync(app, { recursive: true, force: true }))
    const bin = path.join(app, 'bin')
    executable(path.join(bin, 'docker'), '[ -z "$DOCKER_DOWN" ] || exit 1\nprintf ledger')
    executable(path.join(bin, 'curl'), 'printf 200')
    executable(path.join(bin, 'lsof'), 'exit 1')
    executable(path.join(bin, 'dpm'), 'exit 0')
    executable(
      path.join(app, 'node_modules/.bin/canton-barebones'),
      '[ -z "$CANTON_BAREBONES_STATUS" ] || exit "$CANTON_BAREBONES_STATUS"',
    )
    fs.writeFileSync(
      path.join(app, 'package.json'),
      JSON.stringify({ scripts: { 'wallet-gateway': 'true', dev: 'echo ready in 0ms' } }),
    )
    if (contract) {
      fs.mkdirSync(path.join(app, 'daml'))
      fs.writeFileSync(path.join(app, 'daml/daml.yaml'), 'name: app\nversion: 1.0.0\n')
    }
    fs.writeFileSync(path.join(app, '.env'), 'CANTON_BACKEND_TOKEN=test\n')
    const localnet = path.join(app, 'localnet')
    fs.mkdirSync(localnet)
    fs.writeFileSync(
      path.join(localnet, 'canton-barebones.config.json'),
      JSON.stringify({ splice: { tag: '0.0.1' } }),
    )

    return {
      run: (args, options = {}) =>
        spawnSync('bash', [script, ...args, options.localnet ?? localnet], {
          env: {
            ...process.env,
            ...options.env,
            CANTON_APP_DIR: app,
            PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          },
          encoding: 'utf8',
        }),
    }
  }

  const localnetDoesNotStart = { env: { CANTON_BAREBONES_STATUS: '1' } }
  const upgradedInPlace = /\[!\] This ledger was upgraded in place/
  const events = (stdout) =>
    stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
  const warnedOn = (stream) => stream.filter((event) => event.warnings).map((event) => event.status)

  it('warns beside the error of every up that fails after the upgrade', () => {
    const stack = appAfterSpliceBump()

    const first = stack.run(['up'], localnetDoesNotStart)
    const second = stack.run(['up'], localnetDoesNotStart)

    assert.equal(first.status, 1)
    assert.match(first.stderr, /LocalNet did not start/)
    assert.match(first.stdout, upgradedInPlace)
    assert.equal(second.status, 1)
    assert.match(second.stdout, upgradedInPlace)
  })

  it('warns below the summary of the first up that finishes, and not after it', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)

    const finished = stack.run(['up'])
    const next = stack.run(['up'])

    assert.equal(finished.status, 0)
    assert.match(finished.stdout, new RegExp(`Stack is up[\\s\\S]*${upgradedInPlace.source}`))
    assert.equal(next.status, 0)
    assert.doesNotMatch(next.stdout, upgradedInPlace)
  })

  it('lists the warning on the --json error and done events only', () => {
    const stack = appAfterSpliceBump()

    const failed = events(stack.run(['up', '--json'], localnetDoesNotStart).stdout)
    const finished = events(stack.run(['up', '--json']).stdout)

    assert.deepEqual(warnedOn(failed), ['error'])
    assert.deepEqual(warnedOn(finished), ['done'])
    assert.equal(finished.at(-1).warnings.length, 1)
    assert.match(finished.at(-1).warnings[0], /upgraded in place .* run 'reset'\.$/)
  })

  it('warns only on the LocalNet whose ledger was upgraded', () => {
    const stack = appAfterSpliceBump()
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'localnet-'))
    after(() => fs.rmSync(other, { recursive: true, force: true }))
    stack.run(['up'], localnetDoesNotStart)

    const elsewhere = stack.run(['up'], { ...localnetDoesNotStart, localnet: other })

    assert.doesNotMatch(elsewhere.stdout, upgradedInPlace)
  })

  it('warns on an up that fails before it starts', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)

    const refused = stack.run(['up', '--json', '--quiet'])

    assert.match(refused.stderr, /cannot be combined/)
    assert.deepEqual(warnedOn(events(refused.stdout)), ['error'])
  })

  it('stops warning after reset, even on an up that fails before reaching the LocalNet config', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)
    const reset = stack.run(['reset'])

    const failed = stack.run(['up', '--json'], { env: { DOCKER_DOWN: '1' } })

    assert.equal(reset.status, 0)
    assert.match(failed.stderr, /Docker daemon not reachable/)
    assert.doesNotMatch(failed.stderr, upgradedInPlace)
    assert.deepEqual(warnedOn(events(failed.stdout)), [])
  })

  it('keeps warning after a reset that fails to drop the ledger', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)
    const reset = stack.run(['reset'], localnetDoesNotStart)

    const next = stack.run(['up'], localnetDoesNotStart)

    assert.match(reset.stderr, /canton-barebones reset did not finish/)
    assert.match(next.stdout, upgradedInPlace)
  })

  it('leaves the warning out of the errors of every action but up', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)

    const reset = stack.run(['reset'], { env: { DOCKER_DOWN: '1' } })

    assert.match(reset.stderr, /Docker daemon not reachable/)
    assert.doesNotMatch(reset.stdout, upgradedInPlace)
  })

  it('names the contract in the warning only when the project has one', () => {
    const withContract = appAfterSpliceBump({ contract: true })
    const withoutContract = appAfterSpliceBump()

    const contractRun = withContract.run(['up'], localnetDoesNotStart)
    const plainRun = withoutContract.run(['up'], localnetDoesNotStart)

    assert.match(contractRun.stdout, /and the contract builds against that one\./)
    assert.match(plainRun.stdout, /\[!\] It keeps the Amulet its DSO voted in last\.\n/)
  })
})
