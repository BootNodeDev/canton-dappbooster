import fs from 'node:fs'
import path from 'node:path'

/** Copies `.env.example` to `.env`. False when there is no example or a `.env` already. */
export const createEnvFile = (projectDir: string): boolean => {
  const example = path.join(projectDir, '.env.example')
  const env = path.join(projectDir, '.env')
  if (!fs.existsSync(example) || fs.existsSync(env)) {
    return false
  }
  fs.copyFileSync(example, env)
  return true
}
