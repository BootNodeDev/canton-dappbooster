import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const succeeds = async (command: string, args: string[], cwd: string): Promise<boolean> => {
  try {
    await run(command, args, { cwd })
    return true
  } catch {
    return false
  }
}

/** Why the project gets no repository of its own, or undefined when it should get one. */
export const gitSkipReason = async (projectDir: string): Promise<string | undefined> => {
  if (!(await succeeds('git', ['--version'], projectDir))) {
    return 'Skipped: git is not installed.'
  }
  if (
    (await succeeds('git', ['rev-parse', '--is-inside-work-tree'], projectDir)) ||
    (await succeeds('hg', ['--cwd', '.', 'root'], projectDir))
  ) {
    return 'Skipped: the folder is already inside a repository.'
  }
  return undefined
}

/** `git init` and a first commit, as create-next-app does. Removes `.git` again if any step fails. */
export const initGit = async (projectDir: string): Promise<boolean> => {
  const git = (...args: string[]) => run('git', args, { cwd: projectDir })
  try {
    await git('init')
    if (!(await succeeds('git', ['config', 'init.defaultBranch'], projectDir))) {
      await git('checkout', '-b', 'main')
    }
    await git('add', '-A')
    await git('commit', '-m', 'Initial commit from create-canton-dappbooster')
    return true
  } catch {
    fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true })
    return false
  }
}
