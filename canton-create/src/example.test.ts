import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fetchExample, resolveExampleSpec } from '#src/example'
import { scaffold } from '#src/scaffold'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

const fixture = path.resolve(import.meta.dirname, 'testing/fixtures/example-hello')

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
  fs.rmSync(work, { recursive: true, force: true })
})

describe('resolveExampleSpec', () => {
  it('maps a bare name onto the published example scope', () => {
    expect(resolveExampleSpec('amulet-vesting')).toBe('@bootnodedev/canton-example-amulet-vesting')
  })

  it('passes anything npm would understand through untouched', () => {
    expect(resolveExampleSpec('@acme/thing@1.2.3')).toBe('@acme/thing@1.2.3')
    expect(resolveExampleSpec('./local/dir')).toBe('./local/dir')
    expect(resolveExampleSpec('https://x.test/pkg.tgz')).toBe('https://x.test/pkg.tgz')
  })
})

describe('fetchExample', () => {
  it('packs the example and hands back the package, which is the app', async () => {
    const appDir = await fetchExample(fixture, work)

    expect(fs.existsSync(path.join(appDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(appDir, 'src/index.ts'))).toBe(true)
  })

  it('uses a copy already installed where it runs, without npm', async () => {
    const installed = path.join(work, 'node_modules/@bootnodedev/canton-example-hello')
    fs.mkdirSync(installed, { recursive: true })
    fs.writeFileSync(path.join(installed, 'package.json'), '{"name":"installed"}')

    const appDir = await fetchExample('@bootnodedev/canton-example-hello', work, work)

    expect(fs.realpathSync(appDir)).toBe(fs.realpathSync(installed))
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
