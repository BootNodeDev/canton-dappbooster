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

export const install = (manager: PackageManager, cwd: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(manager, ['install'], { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${manager} install exited with ${code}`))
    })
  })
