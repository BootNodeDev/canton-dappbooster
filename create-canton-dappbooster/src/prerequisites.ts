import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const available = async (command: string, args: string[]): Promise<boolean> => {
  try {
    await run(command, args)
    return true
  } catch {
    return false
  }
}

/** What the localnet tier needs on the machine and cannot install: one warning per missing tool. */
export const missingPrerequisites = async (): Promise<string[]> => {
  const checks: [string, string[], string][] = [
    ['docker', ['info'], 'Docker is not running. The LocalNet runs in Docker Compose v2.'],
    [
      'dpm',
      ['--version'],
      'dpm is not on PATH. Install the DAML SDK; daml/daml.yaml pins the version.',
    ],
  ]
  const results = await Promise.all(
    checks.map(async ([command, args, warning]) =>
      (await available(command, args)) ? undefined : warning,
    ),
  )
  return results.filter((warning): warning is string => warning !== undefined)
}
