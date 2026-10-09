import { spawn } from 'node:child_process'

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

const MANAGERS = new Set<PackageManager>(['bun', 'npm', 'pnpm', 'yarn'])

export const isPackageManager = (value: string): value is PackageManager =>
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
export const install = (manager: PackageManager, cwd: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(manager, ['install'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const collect = (chunk: Buffer): void => {
      output += chunk.toString()
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const tail = output.trimEnd().split('\n').slice(-OUTPUT_LINES_ON_FAILURE).join('\n')
      reject(new Error(`${manager} install exited with ${code}\n${tail}`))
    })
  })
