import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import {
  chooseStep,
  composeValue,
  dataVersions,
  migrate,
  migrationPlan,
  restore,
  restoreErrors,
  setupResult,
  unfinishedDump,
} from './localnet-postgres.mjs'

describe('setupResult', () => {
  it('reads the JSON past the progress a first fetch prints', () => {
    const stdout =
      'Fetching Splice canton-network/splice@0.10.2\n{\n  "ok": true,\n  "localnetDir": "/x"\n}\n'

    assert.equal(setupResult(stdout).localnetDir, '/x')
  })
})

describe('unfinishedDump', () => {
  it('finds the dump a stopped move left, and nothing else', () => {
    assert.equal(
      unfinishedDump(['canton-barebones.config.json', 'postgres-14.sql']),
      'postgres-14.sql',
    )
    assert.equal(unfinishedDump(['canton-barebones.config.json', 'upgraded-in-place']), undefined)
    assert.equal(unfinishedDump(['postgres-14.sql.partial']), undefined)
  })
})

describe('composeValue', () => {
  const entries = { POSTGRES_VERSION: `\${POSTGRES_VERSION:-18.6-trixie}`, DB_USER: 'cnadmin' }

  it('prefers an exported value, then the default, then the value as written', () => {
    assert.equal(composeValue(entries, 'POSTGRES_VERSION', '17'), '17')
    assert.equal(composeValue(entries, 'POSTGRES_VERSION', undefined), '18.6-trixie')
    assert.equal(composeValue(entries, 'DB_USER', undefined), 'cnadmin')
  })

  it('throws on a name the env files leave out', () => {
    assert.throws(() => composeValue(entries, 'DB_PASSWORD', undefined), /DB_PASSWORD is not set/)
  })
})

describe('migrationPlan', () => {
  it('moves data a lower major wrote at the volume root, mounted where that image reads it', () => {
    assert.deepEqual(migrationPlan(dataVersions('/volume/PG_VERSION 14\n'), 18), {
      fromMajor: 14,
      mountPath: '/var/lib/postgresql/data',
      toMajor: 18,
    })
  })

  it('mounts data from 18 on at the parent its image reads it under', () => {
    assert.equal(
      migrationPlan(dataVersions('/volume/18/docker/PG_VERSION 18\n'), 19).mountPath,
      '/var/lib/postgresql',
    )
  })

  it('leaves data the target major wrote, and an empty volume, alone', () => {
    assert.equal(migrationPlan(dataVersions('/volume/18/docker/PG_VERSION 18\n'), 18), undefined)
    assert.equal(migrationPlan(dataVersions(''), 18), undefined)
  })

  it('refuses data a newer major wrote', () => {
    assert.throws(
      () => migrationPlan(dataVersions('/volume/18/docker/PG_VERSION 18\n'), 14),
      /newer than the 14/,
    )
  })
})

describe('chooseStep', () => {
  it('moves old data before restoring a dump a stopped move left', () => {
    const plan = { fromMajor: 14, mountPath: '/var/lib/postgresql/data', toMajor: 18 }

    assert.equal(chooseStep(plan, 'postgres-14.sql'), 'migrate')
    assert.equal(chooseStep(undefined, 'postgres-14.sql'), 'restore')
    assert.equal(chooseStep(undefined, undefined), 'nothing')
  })
})

describe('restoreErrors', () => {
  it('ignores what a fresh Postgres already holds', () => {
    const stderr = [
      'ERROR:  role "cnadmin" already exists',
      'ERROR:  database "scan" already exists',
      'ERROR:  relation "contracts" does not exist',
    ].join('\n')

    assert.deepEqual(restoreErrors(stderr), ['ERROR:  relation "contracts" does not exist'])
  })
})

// Docker and the LocalNet tool are doubles that log every call, so no test reaches a real stack.
const doubles = ({ failing = () => false, restoreStderr = '' } = {}) => {
  const calls = []
  const answer = (stdout = '', stderr = '') => ({ stderr, stdout })
  const docker = (args, options = {}) => {
    calls.push(`docker ${args.join(' ')}`)
    if (failing(args)) {
      throw new Error(`docker ${args.join(' ')} failed`)
    }
    if (args[0] === 'inspect') {
      return answer('healthy\n')
    }
    if (args.includes('pg_dumpall')) {
      fs.writeSync(options.stdout, '-- dump\n')
    }
    return args.includes('psql') ? answer('', restoreStderr) : answer()
  }
  const barebones = (args) => {
    calls.push(`canton-barebones ${args.join(' ')}`)
    return answer()
  }
  return { barebones, calls, docker }
}

const position = (calls, pattern) => calls.findIndex((call) => pattern.test(call))

const scratch = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'localnet-postgres-'))
  after(() => fs.rmSync(dir, { force: true, recursive: true }))
  return dir
}

describe('migrate', () => {
  const run = (stack, dumpFile = path.join(scratch(), 'postgres-14.sql')) =>
    migrate({
      barebones: stack.barebones,
      docker: stack.docker,
      dumpFile,
      pause: async () => {},
      plan: { fromMajor: 14, mountPath: '/var/lib/postgresql/data', toMajor: 18 },
      stamp: '20261118120000',
      targetImage: 'postgres:18.6-trixie',
      user: 'cnadmin',
      volume: 'canton-barebones_postgres',
    })

  it('removes the volume only after the backup and the dump, then restores and stops', async () => {
    const stack = doubles()

    const backup = await run(stack)

    assert.equal(backup, 'canton-barebones_postgres-pg14-20261118120000')
    const removed = position(stack.calls, /^docker volume rm canton-barebones_postgres$/)
    assert.ok(position(stack.calls, /-a \/from\/\. \/to\/$/) < removed)
    assert.ok(position(stack.calls, /pg_dumpall/) < removed)
    assert.ok(removed < position(stack.calls, /psql/))
    assert.equal(stack.calls.at(-1), 'canton-barebones stop')
  })

  it('removes a dump container an interrupted run left before copying the volume', async () => {
    const stack = doubles()

    await run(stack)

    const removed = position(stack.calls, /^docker rm --force canton-barebones_postgres-dump$/)
    assert.ok(removed !== -1 && removed < position(stack.calls, /-a \/from\/\. \/to\/$/))
  })

  it('keeps the volume, and leaves no dump a retry would restore, when the dump fails', async () => {
    const stack = doubles({ failing: (args) => args.includes('pg_dumpall') })
    const dumpFile = path.join(scratch(), 'postgres-14.sql')

    await assert.rejects(run(stack, dumpFile), /pg_dumpall/)

    assert.equal(position(stack.calls, /^docker volume rm /), -1)
    assert.ok(!fs.existsSync(dumpFile))
  })

  it('names the backup when the restore reports an error', async () => {
    const stack = doubles({ restoreStderr: 'ERROR:  relation "contracts" does not exist\n' })

    await assert.rejects(
      run(stack),
      /relation "contracts"[\s\S]*canton-barebones_postgres-pg14-20261118120000/,
    )
  })
})

describe('restore', () => {
  it('retries from the dump a stopped move left: stops first, then restores into a new volume', async () => {
    const stack = doubles({ failing: (args) => args[0] === 'volume' && args[1] === 'inspect' })
    const dumpFile = path.join(scratch(), 'postgres-14.sql')
    fs.writeFileSync(dumpFile, '-- dump\n')

    await restore({
      barebones: stack.barebones,
      docker: stack.docker,
      dumpFile,
      pause: async () => {},
      toMajor: 18,
      user: 'cnadmin',
      volume: 'canton-barebones_postgres',
    })

    assert.equal(stack.calls[0], 'canton-barebones stop')
    assert.equal(position(stack.calls, /^docker volume rm /), -1)
    assert.ok(position(stack.calls, /psql/) !== -1)
    assert.ok(!fs.existsSync(dumpFile))
  })
})
