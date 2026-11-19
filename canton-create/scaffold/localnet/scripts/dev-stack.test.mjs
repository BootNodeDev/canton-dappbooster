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

  it('writes a --json line JSON reads back, whatever text the message carries', () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
    after(() => fs.rmSync(app, { recursive: true, force: true }))
    const damlDir = path.join(app, 'da"m\\l\x01\t\r\x1f')
    fs.mkdirSync(damlDir)
    fs.writeFileSync(path.join(damlDir, 'daml.yaml'), 'version: 1.0.0\n')

    const { stdout } = spawnSync('bash', [script, 'up', '--json'], {
      env: { ...process.env, CANTON_APP_DIR: app, DAML_DIR: damlDir },
      encoding: 'utf8',
    })

    const message = `Could not derive DAR name from ${damlDir}/daml.yaml (got '-1.0.0.dar')`
    assert.equal(JSON.parse(stdout).message, message)
    assert.ok(stdout.includes(JSON.stringify(message)))
  })
})

const executable = (file, body) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
}

const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-bin-'))
after(() => fs.rmSync(bin, { recursive: true, force: true }))
executable(
  path.join(bin, 'docker'),
  '[ -z "$DOCKER_DOWN" ] || exit 1\n[ -z "$TERM_UP" ] || kill "$PPID"\n' +
    '[ -z "$POSTGRES_EXITED" ] || [ "$1" != inspect ] || { printf exited; exit 0; }\nprintf ledger',
)
executable(path.join(bin, 'curl'), 'printf 200')
executable(
  path.join(bin, 'lsof'),
  '[ -z "$LSOF_LOG" ] || echo "$*" >>"$LSOF_LOG"\n[ -n "$PORTS_HELD" ] || exit 1\necho 4242',
)
executable(path.join(bin, 'dpm'), 'exit 0')

const appAfterSpliceBump = ({ contract = false } = {}) => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
  after(() => fs.rmSync(app, { recursive: true, force: true }))
  const splice = path.join(app, 'splice')
  fs.mkdirSync(path.join(splice, 'env'), { recursive: true })
  fs.writeFileSync(path.join(splice, 'compose.env'), 'POSTGRES_VERSION=18.6-trixie\n')
  fs.writeFileSync(path.join(splice, 'env/common.env'), 'DB_USER=cnadmin\n')
  executable(
    path.join(app, 'node_modules/.bin/canton-barebones'),
    `[ "$1" != setup ] || { printf '{"localnetDir":"${splice}"}'; exit 0; }\n` +
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
    app,
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

const events = (stdout) =>
  stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))

describe('dev-stack.sh ports', () => {
  const customPorts = (stack) =>
    fs.writeFileSync(
      path.join(stack.app, '.env'),
      'CANTON_BACKEND_TOKEN=test\nDAPP_PORT=3112\n' +
        'VITE_WALLET_GATEWAY_URL=http://localhost:3031/api/v0/dapp\n',
    )
  const heldPorts = (run) =>
    events(run.stdout)
      .at(-1)
      .warnings.filter((warning) => warning.startsWith('Port '))
      .map((warning) => warning.split(' ')[1])
  const portsAsked = (log) => [
    ...new Set([...fs.readFileSync(log, 'utf8').matchAll(/-iTCP:(\d+)/g)].map(([, port]) => port)),
  ]

  it('names the ports .env sets in the warnings when they are held', () => {
    const stack = appAfterSpliceBump()
    customPorts(stack)

    const held = stack.run(['up', '--json'], { env: { PORTS_HELD: '1' } })

    assert.deepEqual(heldPorts(held), ['3031', '3112'])
  })

  it('lets a port the caller exported beat the one in .env', () => {
    const stack = appAfterSpliceBump()
    customPorts(stack)

    const held = stack.run(['up', '--json'], {
      env: {
        DAPP_PORT: '4112',
        PORTS_HELD: '1',
        VITE_WALLET_GATEWAY_URL: 'http://localhost:4031/api/v0/dapp',
      },
    })

    assert.deepEqual(heldPorts(held), ['4031', '4112'])
  })

  it('takes an empty port as the default, whether .env or the caller leaves it empty', () => {
    const emptyInEnv = appAfterSpliceBump()
    fs.writeFileSync(
      path.join(emptyInEnv.app, '.env'),
      'CANTON_BACKEND_TOKEN=test\nDAPP_PORT=\nVITE_WALLET_GATEWAY_URL=\n',
    )
    const emptyFromCaller = appAfterSpliceBump()
    customPorts(emptyFromCaller)

    const fromEnv = emptyInEnv.run(['status'])
    const fromCaller = emptyFromCaller.run(['status'], {
      env: { DAPP_PORT: '', VITE_WALLET_GATEWAY_URL: '' },
    })

    assert.match(fromEnv.stdout, /Dev-server ports 3012 and 3030:/)
    assert.match(fromCaller.stdout, /Dev-server ports 3012 and 3030:/)
  })

  for (const action of ['down', 'status']) {
    it(`checks and lists the ports .env sets on ${action}`, () => {
      const stack = appAfterSpliceBump()
      customPorts(stack)
      const log = path.join(stack.app, 'lsof.log')

      const run = stack.run([action], { env: { LSOF_LOG: log } })

      assert.equal(run.status, 0)
      assert.match(run.stdout, /Dev-server ports 3112 and 3031:/)
      assert.deepEqual(portsAsked(log), ['3112', '3031'])
    })
  }
})

describe('dev-stack.sh after an upgrade in place', () => {
  const localnetDoesNotStart = { env: { CANTON_BAREBONES_STATUS: '1' } }
  const upgradedInPlace = /\[!\] This ledger was upgraded in place/
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

  it('names Postgres when it is what kept the LocalNet from starting', () => {
    const stack = appAfterSpliceBump()

    const failed = stack.run(['up'], {
      env: { CANTON_BAREBONES_STATUS: '1', POSTGRES_EXITED: '1' },
    })
    const other = stack.run(['up'], localnetDoesNotStart)

    assert.match(
      failed.stderr,
      /LocalNet did not start\. Postgres exited: see 'docker logs postgres'\./,
    )
    assert.doesNotMatch(other.stderr, /Postgres exited/)
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

  it('lists every warning of an up, the upgrade warning last, on the --json error and done only', () => {
    const stack = appAfterSpliceBump()

    const failed = events(stack.run(['up', '--json'], localnetDoesNotStart).stdout)
    const finished = events(stack.run(['up', '--json'], { env: { PORTS_HELD: '1' } }).stdout)

    assert.deepEqual(warnedOn(failed), ['error'])
    assert.deepEqual(warnedOn(finished), ['done'])
    const { warnings } = finished.at(-1)
    assert.equal(warnings.length, 3)
    assert.match(warnings[0], /^Port 3030 is held by pid 4242/)
    assert.match(warnings[1], /^Port 3012 is held by pid 4242/)
    assert.match(warnings[2], /^This ledger was upgraded in place .* run 'reset'\.$/)
  })

  it('closes an up that stops outside die with an error and a failing status, still warning', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)
    fs.writeFileSync(
      path.join(stack.app, '.env'),
      'CANTON_BACKEND_TOKEN=test\nVITE_APP_TITLE=Vesting demo\n',
    )

    const stopped = stack.run(['up', '--json'])

    const last = events(stopped.stdout).at(-1)
    assert.equal(stopped.status, 127)
    assert.equal(last.status, 'error')
    assert.match(last.message, /exit status 127/)
    assert.match(last.warnings.at(-1), /^This ledger was upgraded in place/)
    fs.writeFileSync(path.join(stack.app, '.env'), 'CANTON_BACKEND_TOKEN=test\nFOO=$NOT_SET\n')
    assert.equal(stack.run(['up', '--json']).status, 1)
  })

  it('closes an up stopped by TERM with an error, and still ends on the signal', () => {
    const stack = appAfterSpliceBump()

    const terminated = stack.run(['up', '--json'], { env: { TERM_UP: '1' } })

    assert.equal(terminated.signal, 'SIGTERM')
    assert.equal(events(terminated.stdout).at(-1).message, 'The run stopped.')
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
    const stores = path.join(stack.app, '.wallet-gateway')
    fs.mkdirSync(stores)
    const reset = stack.run(['reset'])

    const failed = stack.run(['up', '--json'], { env: { DOCKER_DOWN: '1' } })

    assert.equal(reset.status, 0)
    assert.ok(!fs.existsSync(stores))
    assert.match(failed.stderr, /Docker daemon not reachable/)
    assert.doesNotMatch(failed.stderr, upgradedInPlace)
    assert.deepEqual(warnedOn(events(failed.stdout)), [])
  })

  it('drops the dump of a stopped Postgres move along with the ledger', () => {
    const stack = appAfterSpliceBump()
    const dump = path.join(stack.app, 'localnet', 'postgres-14.sql')
    fs.writeFileSync(dump, '-- dump\n')
    fs.writeFileSync(`${dump}.partial`, '-- dump\n')

    const reset = stack.run(['reset'])

    assert.equal(reset.status, 0)
    assert.ok(!fs.existsSync(dump))
    assert.ok(!fs.existsSync(`${dump}.partial`))
  })

  it('keeps warning after a reset that fails to drop the ledger', () => {
    const stack = appAfterSpliceBump()
    stack.run(['up'], localnetDoesNotStart)
    const stores = path.join(stack.app, '.wallet-gateway')
    fs.mkdirSync(stores)
    const reset = stack.run(['reset'], localnetDoesNotStart)

    const next = stack.run(['up'], localnetDoesNotStart)

    assert.match(reset.stderr, /canton-barebones reset did not finish/)
    assert.ok(fs.existsSync(stores))
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
