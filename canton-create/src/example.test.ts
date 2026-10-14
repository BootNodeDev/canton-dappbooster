import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchExample, resolveExampleSpec } from '#src/example'
import { scaffold } from '#src/scaffold'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

const fixture = path.resolve(import.meta.dirname, 'testing/fixtures/example-hello')
const { version } = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'),
)

const installExample = (dir: string, installedVersion: string): string => {
  const installed = path.join(dir, 'node_modules/@bootnodedev/canton-example-hello')
  fs.mkdirSync(installed, { recursive: true })
  fs.writeFileSync(
    path.join(installed, 'package.json'),
    JSON.stringify({ name: 'installed', version: installedVersion }),
  )
  return installed
}

let packed: PackedScaffold
let work: string

beforeAll(() => {
  packed = packScaffold()
})

afterAll(() => {
  packed.remove()
})

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-example-'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(work, { recursive: true, force: true })
})

describe('resolveExampleSpec', () => {
  it('maps a bare name onto the published example scope', () => {
    expect(resolveExampleSpec('amulet-vesting')).toBe('@bootnodedev/canton-example-amulet-vesting')
  })

  it.each(['amulet-vesting@0.5.6', 'amulet-vesting@^0.5.0', 'amulet-vesting@latest', 'foo.js@1'])(
    'maps %s onto the scope too, version and all',
    (input) => {
      expect(resolveExampleSpec(input)).toBe(`@bootnodedev/canton-example-${input}`)
    },
  )

  it.each([
    '@acme/thing@1.2.3',
    './local/dir',
    'https://x.test/pkg.tgz',
    'pkg.tgz',
    'github:acme/thing',
    'acme/thing',
    'git@github.com:acme/thing.git',
  ])('passes %s through untouched', (input) => {
    expect(resolveExampleSpec(input)).toBe(input)
  })
})

describe('fetchExample', () => {
  it('packs the example and hands back the package, which is the app', async () => {
    const appDir = await fetchExample(fixture, work)

    expect(fs.existsSync(path.join(appDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(appDir, 'src/index.ts'))).toBe(true)
  })

  it('uses a copy on its own version already installed where it runs, without npm', async () => {
    const installed = installExample(work, version)

    const appDir = await fetchExample('@bootnodedev/canton-example-hello', work, work)

    expect(fs.realpathSync(appDir)).toBe(fs.realpathSync(installed))
  })

  it('asks npm when the installed copy is on another version', async () => {
    installExample(work, '0.0.1')
    const bin = path.join(work, 'bin')
    const npmArgs = path.join(work, 'npm-args')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\necho "$@" > "${npmArgs}"\nexit 1\n`, {
      mode: 0o755,
    })
    vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH}`)

    await expect(fetchExample('@bootnodedev/canton-example-hello', work, work)).rejects.toThrow()

    expect(fs.readFileSync(npmArgs, 'utf8')).toContain('pack @bootnodedev/canton-example-hello')
  })
})

describe('scaffolding an example', () => {
  it('names the project, drops the package-only fields and renames _gitignore', async () => {
    const appDir = await fetchExample(fixture, work)
    const target = path.join(work, 'hello')

    scaffold({
      projectName: 'hello',
      targetDir: target,
      appDir,
      scaffoldDir: packed.scaffoldDir,
      localnet: false,
    })

    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
    expect(manifest).toEqual({
      name: 'hello',
      private: true,
      version: '0.0.0',
      scripts: { dev: 'vite' },
    })
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true)
  })

  it('adds the local network on top of an example', async () => {
    const appDir = await fetchExample(fixture, work)
    const target = path.join(work, 'hello')

    scaffold({
      projectName: 'hello',
      targetDir: target,
      appDir,
      scaffoldDir: packed.scaffoldDir,
      localnet: true,
    })

    expect(fs.existsSync(path.join(target, 'scripts/dev-stack.sh'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts/build-dar.mjs'))).toBe(false)
  })
})
