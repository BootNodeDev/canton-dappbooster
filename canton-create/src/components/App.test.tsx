import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { render } from 'ink-testing-library'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '#src/components/App'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

const ENTER = '\r'
const DOWN = '\u001B[B'
const CTRL_C = '\u0003'

let packed: PackedScaffold
let work: string

beforeAll(() => {
  packed = packScaffold()
})

afterAll(() => {
  packed.remove()
})

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-app-'))
})

afterEach(() => {
  fs.rmSync(work, { recursive: true, force: true })
})

const waitFor = async (frame: () => string | undefined, text: string): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (!(frame() ?? '').includes(text)) {
    if (Date.now() > deadline) {
      throw new Error(`"${text}" never appeared in:\n${frame()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

// A component reads keys only once its effect has run, so a key sent on first paint can be lost.
const pressUntil = async (
  stdin: { write: (data: string) => void },
  key: string,
  frame: () => string | undefined,
  text: string,
): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (!(frame() ?? '').includes(text)) {
    if (Date.now() > deadline) {
      throw new Error(`"${text}" never appeared in:\n${frame()}`)
    }
    stdin.write(key)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const fixture = path.resolve(import.meta.dirname, '../testing/fixtures/example-hello')

// An npm that never finishes, so a test can cancel the install while it runs.
const withHangingNpm = async (test: (pidFile: string) => Promise<void>): Promise<void> => {
  const bin = path.join(work, 'bin')
  const pidFile = path.join(work, 'npm.pid')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\necho $ > "${pidFile}"\nexec sleep 30\n`, {
    mode: 0o755,
  })
  const pathBefore = process.env.PATH
  process.env.PATH = `${bin}${path.delimiter}${pathBefore}`
  try {
    await test(pidFile)
  } finally {
    process.env.PATH = pathBefore
  }
}

const waitUntilGone = async (target: string): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (fs.existsSync(target)) {
    if (Date.now() > deadline) {
      throw new Error(`${target} was never removed`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitForFile = async (file: string): Promise<void> => {
  const deadline = Date.now() + 10_000
  while (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').trim() === '') {
    if (Date.now() > deadline) {
      throw new Error(`${file} never appeared`)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

interface Flags {
  directory?: string
  app?: string
  localnet?: boolean
  scaffoldDir?: string
  install?: boolean
}

const run = (flags: Flags) =>
  render(
    <App
      directory={flags.directory}
      app={flags.app}
      localnet={flags.localnet}
      scaffoldDir={flags.scaffoldDir ?? packed.scaffoldDir}
      manager="npm"
      install={flags.install ?? false}
      git={false}
    />,
  )

describe('App', () => {
  it('scaffolds what the flags name and ends with the next steps', async () => {
    const target = path.join(work, 'my-app')
    const { frames } = run({ directory: target, app: 'starter', localnet: false })
    const screen = () => frames.join('\n')

    await waitFor(screen, 'Post-install instructions')

    expect(screen()).toContain('✔ Copying starter')
    expect(screen()).toContain('Install the packages with npm install')
    expect(screen()).toContain('Mock Wallet')
    expect(fs.existsSync(path.join(target, '.env'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts/build-dar.mjs'))).toBe(true)
  })

  it('asks for the name, the local network and the dApp when the flags leave them out', async () => {
    const target = path.join(work, 'typed')
    const { frames, stdin } = run({})
    const screen = () => frames.join('\n')

    await waitFor(screen, 'Project name')
    stdin.write(target)
    await waitFor(screen, 'typed')
    stdin.write(ENTER)
    await waitFor(screen, 'Barebones')
    await pressUntil(stdin, ENTER, screen, 'LocalNet: No localnet')
    await waitFor(screen, 'Starter dApp')
    await pressUntil(stdin, ENTER, screen, 'dApp: Starter dApp')
    await waitFor(screen, 'Post-install instructions')
    expect(fs.existsSync(path.join(target, 'scripts/dev-stack.sh'))).toBe(false)
  })

  it('adds the local network when Barebones is picked', async () => {
    const target = path.join(work, 'net')
    const { frames, stdin } = run({ directory: target, app: 'starter' })
    const screen = () => frames.join('\n')

    await waitFor(screen, 'Barebones')
    await pressUntil(stdin, DOWN, screen, '❯ Barebones')
    await pressUntil(stdin, ENTER, screen, 'LocalNet: Barebones')
    await waitFor(screen, 'Post-install instructions')

    expect(screen()).toContain('with Docker running choose "Stack up"')
    expect(fs.existsSync(path.join(target, 'scripts/dev-stack.sh'))).toBe(true)
  })

  it('starts from an example instead of the starter', async () => {
    const target = path.join(work, 'from-example')
    const { frames } = run({ directory: target, app: fixture, localnet: false })
    const screen = () => frames.join('\n')

    await waitFor(screen, 'Post-install instructions')

    expect(screen()).toContain('Fetching')
    expect(screen()).toContain('Point .env at your network')
    expect(screen()).not.toContain('Mock Wallet')
    expect(fs.existsSync(path.join(target, 'src/index.ts'))).toBe(true)
  })

  it('refuses a folder that is not empty', async () => {
    const taken = path.join(work, 'taken')
    fs.mkdirSync(taken)
    fs.writeFileSync(path.join(taken, 'file'), '')
    const { lastFrame, stdin } = run({})

    await waitFor(lastFrame, 'Project name')
    stdin.write(taken)
    await waitFor(lastFrame, 'taken')
    stdin.write(ENTER)

    await waitFor(lastFrame, 'exists and is not empty.')
  })

  it('exits at Ctrl-C during the questions without writing anything', async () => {
    const target = path.join(work, 'never')
    const { lastFrame, stdin } = run({})

    await waitFor(lastFrame, 'Project name')
    stdin.write(target)
    await waitFor(lastFrame, 'never')
    stdin.write(ENTER)
    await pressUntil(stdin, ENTER, lastFrame, 'LocalNet: No localnet')
    await waitFor(lastFrame, 'Choose the dApp your project starts from')
    stdin.write(CTRL_C)
    await new Promise((resolve) => setTimeout(resolve, 200))
    stdin.write(ENTER)
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(fs.existsSync(target)).toBe(false)
  })

  it('stops the install at Ctrl-C and removes the folder it started', async () => {
    await withHangingNpm(async (pidFile) => {
      const target = path.join(work, 'cancelled')
      const { frames, stdin } = run({
        directory: target,
        app: 'starter',
        localnet: false,
        install: true,
      })

      await waitForFile(pidFile)
      stdin.write(CTRL_C)
      await waitFor(() => frames.join('\n'), 'Cancelled.')
      await waitUntilGone(target)

      expect(isRunning(Number(fs.readFileSync(pidFile, 'utf8')))).toBe(false)
    })
  })

  it('stops the install at SIGINT and removes the folder it started', async () => {
    await withHangingNpm(async (pidFile) => {
      const target = path.join(work, 'interrupted')
      const { frames } = run({ directory: target, app: 'starter', localnet: false, install: true })

      await waitForFile(pidFile)
      process.emit('SIGINT')
      await waitFor(() => frames.join('\n'), 'Cancelled.')
      await waitUntilGone(target)

      expect(isRunning(Number(fs.readFileSync(pidFile, 'utf8')))).toBe(false)
    })
  })

  it('shows the failure and removes the folder it started', async () => {
    const target = path.join(work, 'broken')
    const { frames } = run({
      directory: target,
      app: 'starter',
      localnet: false,
      scaffoldDir: path.join(work, 'missing'),
    })

    await waitFor(() => frames.join('\n'), '✗ Copying starter')

    expect(fs.existsSync(target)).toBe(false)
  })

  it('removes every folder it created on the way to a nested target', async () => {
    const { frames } = run({
      directory: path.join(work, 'a/b/c'),
      app: fixture,
      localnet: true,
      scaffoldDir: path.join(work, 'missing'),
    })

    await waitFor(() => frames.join('\n'), '✗')
    await waitUntilGone(path.join(work, 'a'))
  })
})
