import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEnvFile } from '#src/env'

let work: string

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-env-'))
})

afterEach(() => {
  fs.rmSync(work, { recursive: true, force: true })
})

describe('createEnvFile', () => {
  it('copies .env.example to .env', () => {
    fs.writeFileSync(path.join(work, '.env.example'), 'VITE_MOCK_WALLET=true\n')

    expect(createEnvFile(work)).toBe(true)
    expect(fs.readFileSync(path.join(work, '.env'), 'utf8')).toBe('VITE_MOCK_WALLET=true\n')
  })

  it('does nothing without a .env.example', () => {
    expect(createEnvFile(work)).toBe(false)
    expect(fs.existsSync(path.join(work, '.env'))).toBe(false)
  })

  it('never overwrites an existing .env', () => {
    fs.writeFileSync(path.join(work, '.env.example'), 'FROM_EXAMPLE=1\n')
    fs.writeFileSync(path.join(work, '.env'), 'KEPT=1\n')

    expect(createEnvFile(work)).toBe(false)
    expect(fs.readFileSync(path.join(work, '.env'), 'utf8')).toBe('KEPT=1\n')
  })
})
