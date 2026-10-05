import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchExample, resolveExampleSpec } from '#src/example'
import { scaffoldFromTemplate } from '#src/scaffold'

const fixture = path.resolve(import.meta.dirname, 'testing/fixtures/example-hello')

let work: string

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-example-'))
})

afterEach(() => {
  fs.rmSync(work, { recursive: true, force: true })
})

describe('resolveExampleSpec', () => {
  it('maps a bare name onto the published example scope', () => {
    expect(resolveExampleSpec('vesting')).toBe('@bootnodedev/canton-example-vesting')
  })

  it('passes anything npm would understand through untouched', () => {
    expect(resolveExampleSpec('@acme/thing@1.2.3')).toBe('@acme/thing@1.2.3')
    expect(resolveExampleSpec('./local/dir')).toBe('./local/dir')
    expect(resolveExampleSpec('https://x.test/pkg.tgz')).toBe('https://x.test/pkg.tgz')
  })
})

describe('fetchExample', () => {
  it('packs the example and hands back its template folder', async () => {
    const templateDir = await fetchExample(fixture, work)

    expect(fs.existsSync(path.join(templateDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(templateDir, 'src/index.ts'))).toBe(true)
  })

  it('scaffolds a project out of that folder, named and with its gitignore back', async () => {
    const templateDir = await fetchExample(fixture, work)
    const target = path.join(work, 'hello')

    scaffoldFromTemplate({ projectName: 'hello', targetDir: target, templateDir })

    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'))
    expect(manifest.name).toBe('hello')
    expect(manifest.version).toBe('0.0.0')
    expect(manifest.scripts.dev).toBe('vite')
    expect(fs.existsSync(path.join(target, '.gitignore'))).toBe(true)
  })
})
