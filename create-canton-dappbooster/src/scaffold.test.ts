import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TemplateConflictError } from '#src/merge'
import { scaffold } from '#src/scaffold'

let packed: string
let templatesDir: string

// Scaffolds from the packed tarball, so the tests see what `files` ships and not the working tree.
beforeAll(() => {
  packed = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-packed-'))
  const packageDir = path.resolve(import.meta.dirname, '..')
  const [{ filename }] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', packageDir, '--pack-destination', packed, '--json', '--ignore-scripts'],
      {
        encoding: 'utf8',
      },
    ),
  ) as { filename: string }[]
  execFileSync('tar', ['-xzf', path.join(packed, filename), '-C', packed])
  templatesDir = path.join(packed, 'package', 'templates')
})

afterAll(() => {
  fs.rmSync(packed, { recursive: true, force: true })
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
  it('copies the base, names the package and renames _gitignore', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, templatesDir, tier: 'app' })

    expect(fs.existsSync(path.join(target, 'src/App.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true)
    expect(fs.existsSync(path.join(target, '_gitignore'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'pnpm-workspace.yaml'))).toBe(true)
    expect(manifest(target).name).toBe('my-app')
    expect(manifest(target).private).toBe(true)
    expect(fs.existsSync(path.join(target, 'scripts'))).toBe(false)
    expect(fs.existsSync(path.join(target, 'node_modules'))).toBe(false)
  })

  it('ships real ranges for the kit, never the workspace protocol', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, templatesDir, tier: 'app' })

    const ranges = Object.values(manifest(target).dependencies)
    expect(ranges.some((range) => range.startsWith('workspace:'))).toBe(false)
    expect(manifest(target).dependencies['@bootnodedev/canton-connect']).toMatch(/^\^\d+\.\d+\.\d+/)
  })
})

describe('localnet tier', () => {
  it('adds the stack beside the app and merges the manifest', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, templatesDir, tier: 'localnet' })

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

  it('appends to the files both halves write', () => {
    const target = path.join(work, 'my-app')

    scaffold({ projectName: 'my-app', targetDir: target, templatesDir, tier: 'localnet' })

    expect(read(target, '.gitignore')).toContain('node_modules/')
    expect(read(target, '.gitignore')).toContain('.canton-localnet/')
    expect(read(target, '.gitignore')).toContain('.wallet-gateway/')
    expect(read(target, '.env.example')).toContain('VITE_MOCK_WALLET')
    expect(read(target, '.env.example')).toContain('CANTON_JSON_API_URL')
    expect(read(target, '.env.example')).toContain('VITE_WALLET_GATEWAY_URL')
    expect(read(target, 'README.md')).toContain('## Local network')
  })
})

describe('the fragment rule', () => {
  const fakeTemplates = (fragment: Record<string, string>): string => {
    const dir = path.join(work, 'templates')
    const write = (file: string, content: string): void => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), content)
    }
    write('base/package.json', JSON.stringify({ name: 'base', scripts: { dev: 'vite' } }))
    write('base/src/App.tsx', 'base')
    for (const [file, content] of Object.entries(fragment)) {
      write(`localnet/${file}`, content)
    }
    return dir
  }

  it('refuses a fragment that rewrites a base file', () => {
    const templates = fakeTemplates({ 'src/App.tsx': 'overwritten' })

    expect(() =>
      scaffold({
        projectName: 'x',
        targetDir: path.join(work, 'out'),
        templatesDir: templates,
        tier: 'localnet',
      }),
    ).toThrow(TemplateConflictError)
  })

  it('refuses a fragment that redefines a base script', () => {
    const templates = fakeTemplates({
      'package.json': JSON.stringify({ scripts: { dev: 'something else' } }),
    })

    expect(() =>
      scaffold({
        projectName: 'x',
        targetDir: path.join(work, 'out'),
        templatesDir: templates,
        tier: 'localnet',
      }),
    ).toThrow(/redefines scripts: dev/)
  })
})
