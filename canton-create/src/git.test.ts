import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gitSkipReason, initGit } from '#src/git'

let work: string
let project: string

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim()

beforeEach(() => {
  work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-git-')))
  project = path.join(work, 'project')
  fs.mkdirSync(project)
  const config = path.join(work, 'gitconfig')
  fs.writeFileSync(config, '[user]\n\tname = Test\n\temail = test@example.com\n')
  vi.stubEnv('GIT_CONFIG_GLOBAL', config)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
  fs.rmSync(work, { recursive: true, force: true })
})

describe('gitSkipReason', () => {
  it('lets a folder outside any repository through', async () => {
    expect(await gitSkipReason(project)).toBeUndefined()
  })

  it('skips a folder inside another repository', async () => {
    execFileSync('git', ['init'], { cwd: work })

    expect(await gitSkipReason(project)).toBe('Skipped: the folder is already inside a repository.')
  })
})

describe('initGit', () => {
  it('creates a repository on main with one commit', async () => {
    fs.writeFileSync(path.join(project, 'README.md'), '# project\n')

    expect(await initGit(project)).toBe(true)
    expect(git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(git('log', '--format=%s')).toBe('Initial commit from create-canton-dappbooster')
  })

  it('removes .git when the first commit fails', async () => {
    expect(await initGit(project)).toBe(false)
    expect(fs.existsSync(path.join(project, '.git'))).toBe(false)
  })
})
