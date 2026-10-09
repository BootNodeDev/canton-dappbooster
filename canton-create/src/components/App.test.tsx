import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { render } from 'ink-testing-library'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '#src/components/App'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

const ENTER = '\r'

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

const app = (props: { directory?: string; scaffoldDir?: string }) =>
  render(
    <App
      directory={props.directory}
      tier={props.directory === undefined ? undefined : 'app'}
      scaffoldDir={props.scaffoldDir ?? packed.scaffoldDir}
      manager="npm"
      install={false}
      git={false}
    />,
  )

describe('App', () => {
  it('scaffolds the tier the flags name and ends with the next steps', async () => {
    const target = path.join(work, 'my-app')
    const { lastFrame } = app({ directory: target })

    await waitFor(lastFrame, 'Post-install instructions')

    expect(lastFrame()).toContain('✔ Copying the app template')
    expect(lastFrame()).toContain('Install the packages with npm install')
    expect(fs.existsSync(path.join(target, '.env'))).toBe(true)
  })

  it('asks for the name and the tier when the flags leave them out', async () => {
    const target = path.join(work, 'typed')
    const { lastFrame, stdin } = app({})

    await waitFor(lastFrame, 'Project name')
    stdin.write(target)
    await waitFor(lastFrame, 'typed')
    stdin.write(ENTER)
    await waitFor(lastFrame, 'What do you want to create?')
    stdin.write(ENTER)
    await waitFor(lastFrame, 'Post-install instructions')

    expect(lastFrame()).toContain('Tier: app')
    expect(fs.existsSync(path.join(target, 'package.json'))).toBe(true)
  })

  it('refuses a folder that is not empty', async () => {
    const taken = path.join(work, 'taken')
    fs.mkdirSync(taken)
    fs.writeFileSync(path.join(taken, 'file'), '')
    const { lastFrame, stdin } = app({})

    await waitFor(lastFrame, 'Project name')
    stdin.write(taken)
    await waitFor(lastFrame, 'taken')
    stdin.write(ENTER)

    await waitFor(lastFrame, 'exists and is not empty.')
  })

  it('shows the failure and removes the folder it started', async () => {
    const target = path.join(work, 'broken')
    const { frames } = app({ directory: target, scaffoldDir: path.join(work, 'missing') })

    await waitFor(() => frames.join('\n'), '✗ Copying the app template')

    expect(fs.existsSync(target)).toBe(false)
  })
})
