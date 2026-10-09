import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ScaffoldConflictError } from '#src/merge'
import { scaffold } from '#src/scaffold'
import { type PackedScaffold, packScaffold } from '#src/testing/packedScaffold'

let packed: PackedScaffold
let scaffoldDir: string

beforeAll(() => {
  packed = packScaffold()
  scaffoldDir = packed.scaffoldDir
})

afterAll(() => {
  packed.remove()
})

const read = (dir: string, file: string): string => fs.readFileSync(path.join(dir, file), 'utf8')
const manifest = (dir: string): Record<string, Record<string, string>> =>
  JSON.parse(read(dir, 'package.json')) as Record<string, Record<string, string>>

let work: string

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-'))
})

afterEach(() => {
  fs.rmSync(work, { recursive: true, force: true })
})

describe('app tier', () => {
  it('copies the starter, names the package and renames _gitignore', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'app' })

    expect(fs.existsSync(path.join(target, 'src/App.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true)
    expect(fs.existsSync(path.join(target, '_gitignore'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'pnpm-workspace.yaml'))).toBe(true)
    expect(manifest(target).name).toBe('my-app')
    expect(manifest(target).private).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts/dev-stack.sh'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'node_modules'))).toBe(false)
  })

  it('adds the DAML tooling because the starter has a contract', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'app' })

    expect(fs.existsSync(path.join(target, 'daml/daml.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts/build-dar.mjs'))).toBe(true)
    expect(manifest(target).scripts['build-dar']).toBeDefined()
    expect(manifest(target).scripts['deploy-dar']).toBeDefined()
    expect(read(target, '.gitignore')).toContain('daml/.daml/')
    expect(read(target, 'README.md')).toContain('## Contract')
  })

  it('ships real ranges for the kit, never the workspace protocol', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'app' })

    const ranges = Object.values(manifest(target).dependencies)
    expect(ranges.some((range) => range.startsWith('workspace:'))).toBe(false)
    expect(manifest(target).dependencies['@bootnodedev/canton-connect']).toMatch(/^\^\d+\.\d+\.\d+/)
  })
})

describe('localnet tier', () => {
  it('adds the stack beside the app and merges the manifest', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'localnet' })

    expect(fs.existsSync(path.join(target, 'scripts/dev-stack.sh'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts/build-dar.mjs'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'daml/daml.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(target, 'wallet-gateway.config.json'))).toBe(true)
    const { scripts, devDependencies } = manifest(target)
    expect(scripts.dev).toBeDefined()
    expect(scripts.stack).toBe('bash scripts/dev-stack.sh')
    expect(scripts['wallet-gateway']).toBeDefined()
    expect(devDependencies['@bootnodedev/canton-barebones']).toBeDefined()
    expect(devDependencies['@canton-network/wallet-gateway-remote']).toBeDefined()
    expect(devDependencies.vite).toBeDefined()
  })

  it('appends to the files every layer writes', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'localnet' })

    expect(read(target, '.gitignore')).toContain('node_modules/')
    expect(read(target, '.gitignore')).toContain('.canton-localnet/')
    expect(read(target, '.gitignore')).toContain('.wallet-gateway/')
    expect(read(target, '.env.example')).toContain('VITE_MOCK_WALLET')
    expect(read(target, '.env.example')).toContain('CANTON_JSON_API_URL')
    expect(read(target, '.env.example')).toContain('CANTON_AUTH_SECRET')
    expect(read(target, '.env.example')).toContain('VITE_WALLET_GATEWAY_URL')
    expect(read(target, 'README.md')).toContain('## Contract')
    expect(read(target, 'README.md')).toContain('## Local network')
  })

  it('sets every .env.example key once', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, scaffoldDir, tier: 'localnet' })

    const keys = [...read(target, '.env.example').matchAll(/^([A-Z_]+)=/gm)].map(([, key]) => key)
    expect(keys).toEqual([...new Set(keys)])
  })
})

describe('the layer rule', () => {
  const fakeScaffold = (layers: Record<string, string>): string => {
    const dir = path.join(work, 'scaffold')
    const write = (file: string, content: string): void => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), content)
    }
    write('starter/package.json', JSON.stringify({ name: 'starter', scripts: { dev: 'vite' } }))
    write('starter/src/App.tsx', 'starter')
    write('daml-tooling/scripts/build-dar.mjs', '')
    for (const [file, content] of Object.entries(layers)) {
      write(file, content)
    }
    return dir
  }

  it('leaves out the DAML tooling when the app has no daml/', () => {
    const target = path.join(work, 'out')

    scaffold({ projectName: 'x', targetDir: target, scaffoldDir: fakeScaffold({}), tier: 'app' })

    expect(fs.existsSync(path.join(target, 'scripts/build-dar.mjs'))).toBe(false)
  })

  it('refuses a layer that rewrites a file an earlier one wrote', () => {
    const scaffoldDir = fakeScaffold({ 'localnet/src/App.tsx': 'overwritten' })

    expect(() =>
      scaffold({
        projectName: 'x',
        targetDir: path.join(work, 'out'),
        scaffoldDir,
        tier: 'localnet',
      }),
    ).toThrow(ScaffoldConflictError)
  })

  it('refuses a layer that redefines a script', () => {
    const scaffoldDir = fakeScaffold({
      'localnet/package.json': JSON.stringify({ scripts: { dev: 'something else' } }),
    })

    expect(() =>
      scaffold({
        projectName: 'x',
        targetDir: path.join(work, 'out'),
        scaffoldDir,
        tier: 'localnet',
      }),
    ).toThrow(/redefines scripts: dev/)
  })
})
