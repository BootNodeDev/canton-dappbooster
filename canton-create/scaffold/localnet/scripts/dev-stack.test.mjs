import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

const script = path.join(import.meta.dirname, 'dev-stack.sh')

describe('dev-stack.sh arguments', () => {
  it('drops the -- pnpm forwards before reading the action', () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-stack-'))
    after(() => fs.rmSync(app, { recursive: true, force: true }))

    const { status, stderr } = spawnSync('bash', [script, '--', 'up', '--json', '--quiet'], {
      env: { ...process.env, CANTON_APP_DIR: app },
      encoding: 'utf8',
    })

    assert.equal(status, 1)
    assert.match(stderr, /--json and --quiet cannot be combined/)
  })
})
