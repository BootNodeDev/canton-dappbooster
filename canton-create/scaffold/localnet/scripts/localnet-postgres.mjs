#!/usr/bin/env node
//
// Moves the LocalNet's Postgres data to the major version the pinned Splice release runs.
//
// Postgres refuses data another major version wrote, so a Splice release that moves the
// major (0.10 went from 14 to 18) leaves an existing ledger unable to start. This dumps
// the data with the old major, lets Compose recreate the volume on the new one, and
// restores it there. The old data stays in a backup volume until the developer drops it.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CONFIG_NAME = 'canton-barebones.config.json'
const READY_TIMEOUT_SECONDS = 120

// Below 18 the image keeps PG_VERSION at the volume root; from 18 under <major>/docker.
const PROBE =
  'for file in /volume/PG_VERSION /volume/*/docker/PG_VERSION; do [ -f "$file" ] && echo "$file $(cat "$file")"; done; true'

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/

const readDotenv = (filePath) =>
  Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .map((line) => line.match(ASSIGNMENT))
      .filter((match) => match !== null)
      .map(([, name, value]) => [name, value]),
  )

/**
 * Resolves a Compose env file entry the way Compose does: an exported value wins, then
 * the `${NAME:-default}` default, then the value as written.
 */
export const composeValue = (entries, name, exported = process.env[name]) => {
  if (exported) {
    return exported
  }
  const value = entries[name]
  if (value === undefined) {
    throw new Error(`${name} is not set in the Splice LocalNet env files`)
  }
  return value.match(new RegExp(`^\\$\\{${name}:-(.+)\\}$`))?.[1] ?? value
}

/** Each PG_VERSION the probe found, as its path and the major that wrote it. */
export const dataVersions = (probeOutput) =>
  probeOutput
    .split('\n')
    .map((line) => line.trim().split(' '))
    .filter(([file, major]) => file?.endsWith('PG_VERSION') && /^\d+$/.test(major ?? ''))
    .map(([file, major]) => ({ file, major: Number(major) }))

/**
 * The data to move, or undefined when it already matches the target major. Throws on data a
 * newer major wrote, which a dump cannot carry back down.
 */
export const migrationPlan = (versions, targetMajor) => {
  const stale = versions.find(({ major }) => major !== targetMajor)
  if (stale === undefined) {
    return undefined
  }
  if (stale.major > targetMajor) {
    throw new Error(
      `the LocalNet's data was written by Postgres ${stale.major}, newer than the ${targetMajor} this Splice release runs. ` +
        "Move to a canton-barebones release that runs it, or run 'reset' to start over.",
    )
  }
  return {
    fromMajor: stale.major,
    mountPath:
      stale.file === '/volume/PG_VERSION' ? '/var/lib/postgresql/data' : '/var/lib/postgresql',
    toMajor: targetMajor,
  }
}

// `setup` prints its progress, such as fetching a new Splice checkout, ahead of the JSON.
export const setupResult = (stdout) => {
  const start = stdout.search(/^\{/m)
  if (start === -1) {
    throw new Error(`canton-barebones setup --json printed no JSON: ${stdout.trim()}`)
  }
  return JSON.parse(stdout.slice(start))
}

// restore() deletes the dump only once it succeeds, so one left behind marks a move that stopped.
export const unfinishedDump = (fileNames) =>
  fileNames.find((name) => /^postgres-\d+\.sql$/.test(name))

/** Old data is moved before anything else; a dump a stopped move left is restored only after. */
export const chooseStep = (plan, leftover) => {
  if (plan !== undefined) {
    return 'migrate'
  }
  return leftover === undefined ? 'nothing' : 'restore'
}

// A fresh Postgres already holds the roles and databases Splice's entrypoint creates.
export const restoreErrors = (stderr) =>
  stderr.split('\n').filter((line) => line.includes('ERROR:') && !line.includes('already exists'))

const waitUntil = async (isReady, label, pause) => {
  for (let second = 0; second < READY_TIMEOUT_SECONDS; second++) {
    if (isReady()) {
      return
    }
    await pause()
  }
  throw new Error(`${label} was not ready within ${READY_TIMEOUT_SECONDS}s`)
}

const succeeds = (action) => {
  try {
    action()
    return true
  } catch {
    return false
  }
}

const outputOf = (action) => {
  try {
    return action().stdout.trim()
  } catch {
    return ''
  }
}

const withFile = (filePath, flags, use) => {
  const descriptor = fs.openSync(filePath, flags)
  try {
    return use(descriptor)
  } finally {
    fs.closeSync(descriptor)
  }
}

/**
 * Lets Compose recreate the volume on the new major and restores the dump into it, then
 * stops the stack and deletes the dump. Safe to run again after it stops halfway.
 */
export const restore = async ({
  barebones,
  docker,
  dumpFile,
  pause = () => sleep(1000),
  toMajor,
  user,
  volume,
}) => {
  try {
    // A Postgres left running by a restore that stopped would keep the volume in use.
    barebones(['stop'])
    if (succeeds(() => docker(['volume', 'inspect', volume]))) {
      docker(['volume', 'rm', volume])
    }
    barebones(['compose', 'up', '--detach', 'postgres'])
    await waitUntil(
      () =>
        outputOf(() => docker(['inspect', '--format', '{{.State.Health.Status}}', 'postgres'])) ===
        'healthy',
      `Postgres ${toMajor}`,
      pause,
    )
    const result = withFile(dumpFile, 'r', (input) =>
      docker(['exec', '--interactive', 'postgres', 'psql', '-q', '-U', user, '-d', 'postgres'], {
        stdin: input,
      }),
    )
    const errors = restoreErrors(result.stderr)
    if (errors.length > 0) {
      throw new Error(`the restore reported:\n${errors.join('\n')}`)
    }
    barebones(['stop'])
  } catch (error) {
    throw new Error(`${error.message}\nThe dump stays in ${dumpFile}; run 'up' again to retry.`)
  }
  fs.rmSync(dumpFile, { force: true })
}

/**
 * Copies the volume to a backup, dumps it with the old major, then restores it on the new
 * one. The volume is removed only once the backup and the dump both exist. Returns the
 * backup volume's name.
 */
export const migrate = async ({
  barebones,
  docker,
  dumpFile,
  pause = () => sleep(1000),
  plan,
  stamp,
  targetImage,
  user,
  volume,
}) => {
  const backup = `${volume}-pg${plan.fromMajor}-${stamp}`
  const dumper = `${volume}-dump`

  // One left by an interrupted run still has the volume open, which would make the copy inconsistent.
  succeeds(() => docker(['rm', '--force', dumper]))
  barebones(['stop'])
  docker(['volume', 'create', backup])
  docker([
    'run',
    '--rm',
    '--volume',
    `${volume}:/from:ro`,
    '--volume',
    `${backup}:/to`,
    '--entrypoint',
    'cp',
    targetImage,
    '-a',
    '/from/.',
    '/to/',
  ])

  docker([
    'run',
    '--detach',
    '--name',
    dumper,
    '--user',
    'postgres',
    '--volume',
    `${volume}:${plan.mountPath}`,
    `postgres:${plan.fromMajor}`,
  ])
  try {
    await waitUntil(
      () => succeeds(() => docker(['exec', dumper, 'pg_isready', '-U', user, '-d', 'postgres'])),
      `Postgres ${plan.fromMajor}`,
      pause,
    )
    // Named as the dump only once complete, since a file under that name is what a retry restores.
    const partial = `${dumpFile}.partial`
    withFile(partial, 'w', (output) => {
      docker(['exec', dumper, 'pg_dumpall', '-U', user], { stdout: output })
      fs.fsyncSync(output)
    })
    fs.renameSync(partial, dumpFile)
  } finally {
    succeeds(() => docker(['rm', '--force', dumper]))
  }

  try {
    await restore({ barebones, docker, dumpFile, pause, toMajor: plan.toMajor, user, volume })
  } catch (error) {
    throw new Error(
      `${error.message}\nThe Postgres ${plan.fromMajor} data is safe in the volume ${backup}.`,
    )
  }
  return backup
}

const run = (command, args, { cwd, stdin, stdout } = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: [stdin ?? 'ignore', stdout ?? 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim()}`)
  }
  return { stderr: result.stderr, stdout: result.stdout ?? '' }
}

const main = async () => {
  const [targetDir, barebonesBin] = process.argv.slice(2)
  if (targetDir === undefined || barebonesBin === undefined) {
    throw new Error(
      'Usage: node scripts/localnet-postgres.mjs <localnet-dir> <canton-barebones-bin>',
    )
  }

  const docker = (args, options) => run('docker', args, options)
  const barebones = (args) => run(barebonesBin, args, { cwd: targetDir })
  const { composeProjectName } = JSON.parse(
    fs.readFileSync(path.join(targetDir, CONFIG_NAME), 'utf8'),
  )
  const volume = `${composeProjectName}_postgres`
  const leftover = unfinishedDump(fs.readdirSync(targetDir))
  const hasVolume = succeeds(() => docker(['volume', 'inspect', volume]))
  if (!hasVolume && leftover === undefined) {
    return
  }

  const { localnetDir } = setupResult(barebones(['setup', '--json']).stdout)
  const env = {
    ...readDotenv(path.join(localnetDir, 'compose.env')),
    ...readDotenv(path.join(localnetDir, 'env', 'common.env')),
  }
  const targetVersion = composeValue(env, 'POSTGRES_VERSION')
  const targetMajor = Number.parseInt(targetVersion, 10)
  const targetImage = `postgres:${targetVersion}`
  const user = composeValue(env, 'DB_USER')
  const probe = () =>
    docker([
      'run',
      '--rm',
      '--volume',
      `${volume}:/volume:ro`,
      '--entrypoint',
      'sh',
      targetImage,
      '-c',
      PROBE,
    ])
  const plan = hasVolume ? migrationPlan(dataVersions(probe().stdout), targetMajor) : undefined
  const step = chooseStep(plan, leftover)

  if (step === 'migrate') {
    console.log(
      `localnet-postgres: moving ${volume} from Postgres ${plan.fromMajor} to ${plan.toMajor}...`,
    )
    const backup = await migrate({
      barebones,
      docker,
      dumpFile: path.join(targetDir, `postgres-${plan.fromMajor}.sql`),
      plan,
      stamp: new Date().toISOString().replace(/\D/g, '').slice(0, 14),
      targetImage,
      user,
      volume,
    })
    console.log(
      `localnet-postgres: moved. The Postgres ${plan.fromMajor} data stays in the volume ${backup}; ` +
        `drop it with 'docker volume rm ${backup}' once the ledger works.`,
    )
    return
  }

  if (step === 'restore') {
    console.log(`localnet-postgres: an earlier move stopped; restoring ${leftover} again...`)
    await restore({
      barebones,
      docker,
      dumpFile: path.join(targetDir, leftover),
      toMajor: targetMajor,
      user,
      volume,
    })
    console.log('localnet-postgres: moved. The old data stays in its backup volume.')
  }
}

// argv[1] keeps a symlink that import.meta.filename resolves, so compare real paths.
if (fs.realpathSync(process.argv[1]) === import.meta.filename) {
  await main()
}
