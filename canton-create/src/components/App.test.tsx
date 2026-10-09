import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { render } from 'ink-testing-library'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '#src/components/App'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

const ENTER = '\r'
const DOWN = '\u001B[B'

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

interface Flags {
  directory?: string
  app?: string
  localnet?: boolean
  scaffoldDir?: string
}

const run = (flags: Flags) =>
  render(
    <App
      directory={flags.directory}
      app={flags.app}
      localnet={flags.localnet}
      scaffoldDir={flags.scaffoldDir ?? packed.scaffoldDir}
      manager="npm"
      install={false}
      git={false}
    />,
  )

describe('App', () => {
  it('scaffolds what the flags name and ends with the next steps', async () => {
    const target = path.join(work, 'my-app')
    const { lastFrame } = run({ directory: target, app: 'starter', localnet: false })

    await waitFor(lastFrame, 'Post-install instructions')

    expect(lastFrame()).toContain('✔ Copying starter')
    expect(lastFrame()).toContain('Install the packages with npm install')
    expect(lastFrame()).toContain('Mock Wallet')
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
    const { lastFrame } = run({ directory: target, app: fixture, localnet: false })

    await waitFor(lastFrame, 'Post-install instructions')

    expect(lastFrame()).toContain('Fetching')
    expect(lastFrame()).toContain('Point .env at your network')
    expect(lastFrame()).not.toContain('Mock Wallet')
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
})
