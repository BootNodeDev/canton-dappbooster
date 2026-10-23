import fs from 'node:fs'
import path from 'node:path'

export const isEmptyDir = (dir: string): boolean =>
  !fs.existsSync(dir) || fs.readdirSync(dir).filter((name) => name !== '.git').length === 0

export interface ProjectFacts {
  dar: string | undefined
  needsSpliceTag: boolean
  hasBootstrap: boolean
}

/** What the closing screen needs to know about the project a run made. */
export const readProject = (dir: string): ProjectFacts => {
  const damlYaml = path.join(dir, 'daml', 'daml.yaml')
  const yaml = fs.existsSync(damlYaml) ? fs.readFileSync(damlYaml, 'utf8') : ''
  const field = (key: string) => yaml.match(new RegExp(`^${key}:\\s*(\\S+)`, 'm'))?.[1]
  const name = field('name')
  const version = field('version')
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  return {
    dar: name && version ? `daml/.daml/dist/${name}-${version}.dar` : undefined,
    needsSpliceTag: /^\s*-\s*deps\//m.test(yaml),
    hasBootstrap: manifest.scripts?.bootstrap !== undefined,
  }
}

/** The highest folder on the way to `dir` that does not exist yet, or `undefined` when `dir` does. */
export const firstMissingFolder = (dir: string): string | undefined => {
  if (fs.existsSync(dir)) {
    return undefined
  }
  let missing = dir
  while (!fs.existsSync(path.dirname(missing))) {
    missing = path.dirname(missing)
  }
  return missing
}

/**
 * Undoes a failed run: deletes the folders it created from `created` down, or empties the one it
 * was given except `.git`.
 */
export const removeScaffold = (dir: string, created: string | undefined): void => {
  if (created !== undefined) {
    fs.rmSync(created, { recursive: true, force: true })
    return
  }
  for (const name of fs.readdirSync(dir)) {
    if (name !== '.git') {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
}
