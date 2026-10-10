import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const EXAMPLE_SCOPE = '@bootnodedev/canton-example-'
const PACKAGE_NAME = /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9.-]*$/

/** A bare name means a published example; anything else is passed to npm as it is. */
export const resolveExampleSpec = (input: string): string =>
  /^[a-z][a-z0-9-]*$/.test(input) ? `${EXAMPLE_SCOPE}${input}` : input

// Only for a package name: a local folder spec would resolve to a working tree, node_modules included.
const installedExample = (spec: string, cwd: string): string | undefined => {
  if (!PACKAGE_NAME.test(spec)) {
    return undefined
  }
  try {
    const manifest = createRequire(path.join(cwd, 'package.json')).resolve(`${spec}/package.json`)
    return path.dirname(manifest)
  } catch {
    return undefined
  }
}

/**
 * The folder holding an example's app: the copy already installed where the CLI runs, as `try`
 * arranges, else the package `npm pack` fetches into `workDir`. `npm pack` takes any spec npm
 * understands: a name, a tarball URL or a local directory.
 */
export const fetchExample = async (
  spec: string,
  workDir: string,
  cwd = process.cwd(),
): Promise<string> => {
  const installed = installedExample(spec, cwd)
  if (installed !== undefined) {
    return installed
  }
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
  return path.join(workDir, 'package')
}
