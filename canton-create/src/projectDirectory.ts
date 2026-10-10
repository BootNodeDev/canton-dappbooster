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

/** Undoes a failed run: deletes the folder it created, or empties the one it was given except `.git`. */
export const removeScaffold = (dir: string, existedBefore: boolean): void => {
  if (!existedBefore) {
    fs.rmSync(dir, { recursive: true, force: true })
    return
  }
  for (const name of fs.readdirSync(dir)) {
    if (name !== '.git') {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
}
