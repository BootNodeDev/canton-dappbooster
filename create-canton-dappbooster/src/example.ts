import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const EXAMPLE_SCOPE = '@bootnodedev/canton-example-'

/** `vesting` names the published example; anything else is passed to npm as it is. */
export const resolveExampleSpec = (input: string): string =>
  /^[a-z][a-z0-9-]*$/.test(input) ? `${EXAMPLE_SCOPE}${input}` : input

/**
 * Fetches an example package the way CRA fetched a `cra-template`: `npm pack` resolves any spec
 * npm understands, a name, a tarball URL or a local directory, and its `template/` folder is
 * the project. Returns that folder, inside `workDir`.
 */
export const fetchExample = async (spec: string, workDir: string): Promise<string> => {
  const { stdout } = await run('npm', [
    'pack',
    spec,
    '--pack-destination',
    workDir,
    '--json',
    '--ignore-scripts',
  ])
  const [packed] = JSON.parse(stdout) as { filename: string }[]
  if (packed === undefined) {
    throw new Error(`npm pack produced nothing for ${spec}`)
  }
  await run('tar', ['-xzf', path.join(workDir, packed.filename), '-C', workDir])

  const templateDir = path.join(workDir, 'package', 'template')
  if (!fs.existsSync(path.join(templateDir, 'package.json'))) {
    throw new Error(`${spec} is not an example: it ships no template/package.json`)
  }
  return templateDir
}
