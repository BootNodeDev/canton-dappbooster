import { spawn } from 'node:child_process'

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

const MANAGERS = new Set<PackageManager>(['bun', 'npm', 'pnpm', 'yarn'])

const isPackageManager = (value: string): value is PackageManager =>
  MANAGERS.has(value as PackageManager)

// `npm create x` runs through the invoking manager, which names itself in this variable; that is
// how create-vite and create-next-app decide too.
export const detectPackageManager = (
  userAgent: string | undefined = process.env.npm_config_user_agent,
): PackageManager => {
  const name = userAgent?.split(' ')[0]?.split('/')[0]
  return name !== undefined && isPackageManager(name) ? name : 'npm'
}

export const runScript = (manager: PackageManager, script: string): string =>
  manager === 'npm' ? `npm run ${script}` : `${manager} ${script}`

const OUTPUT_LINES_ON_FAILURE = 20

// Output is captured, not inherited: it would draw over the Ink screen.
export const install = (
  manager: PackageManager,
  cwd: string,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(manager, ['install'], { cwd, stdio: ['ignore', 'pipe', 'pipe'], signal })
    let output = ''
    const collect = (chunk: Buffer): void => {
      output += chunk.toString()
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    // An abort settles on close, once the child has exited and the folder it wrote into can go.
    child.on('error', (error) => {
      if (!signal?.aborted) {
        reject(error)
      }
    })
    child.on('close', (code) => {
      if (signal?.aborted) {
        reject(signal.reason)
        return
      }
      if (code === 0) {
        resolve()
        return
      }
      const tail = output.trimEnd().split('\n').slice(-OUTPUT_LINES_ON_FAILURE).join('\n')
      reject(new Error(`${manager} install exited with ${code}\n${tail}`))
    })
  })
