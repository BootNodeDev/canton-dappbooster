import fs from 'node:fs'
import path from 'node:path'
import {
  APPENDABLE,
  finalizeManifest,
  mergeEnvExample,
  mergeManifests,
  ScaffoldConflictError,
} from '#src/merge'

export const TIERS = {
  app: 'A web app that connects to a Canton wallet (a mock one is built in)',
  localnet: 'The web app plus a Canton network on your computer, in Docker',
} as const

export type Tier = keyof typeof TIERS

export const isTier = (value: string): value is Tier => value in TIERS

// npm drops a `.gitignore` from every tarball it packs, and a `pnpm-workspace.yaml` inside the
// monorepo would make pnpm treat the template as its own workspace root, so both travel renamed.
const RENAMES: Record<string, string> = {
  _gitignore: '.gitignore',
  '_pnpm-workspace.yaml': 'pnpm-workspace.yaml',
}

const publishedName = (name: string): string => RENAMES[name] ?? name

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>

const writeJson = (file: string, value: unknown): void => {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

const walk = (dir: string, prefix = ''): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name)
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [relative]
  })

const copyTree = (from: string, to: string): string[] =>
  walk(from).map((relative) => {
    const target = path.join(path.dirname(relative), publishedName(path.basename(relative)))
    fs.mkdirSync(path.dirname(path.join(to, target)), { recursive: true })
    fs.copyFileSync(path.join(from, relative), path.join(to, target))
    return target
  })

const applyFragment = (fragmentDir: string, targetDir: string): string[] =>
  walk(fragmentDir).flatMap((relative) => {
    const source = path.join(fragmentDir, relative)
    const target = path.join(path.dirname(relative), publishedName(path.basename(relative)))
    const destination = path.join(targetDir, target)

    if (target === 'package.json') {
      writeJson(destination, mergeManifests(readJson(destination), readJson(source)))
      return []
    }
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(source, destination)
      return [target]
    }
    if (path.basename(target) === '.env.example') {
      const merged = mergeEnvExample(
        fs.readFileSync(destination, 'utf8'),
        fs.readFileSync(source, 'utf8'),
      )
      fs.writeFileSync(destination, merged)
      return []
    }
    if (APPENDABLE.has(path.basename(target))) {
      fs.appendFileSync(destination, fs.readFileSync(source))
      return []
    }
    throw new ScaffoldConflictError(`a layer rewrites a file an earlier one wrote: ${target}`)
  })

export interface ScaffoldFromTemplateOptions {
  projectName: string
  targetDir: string
  templateDir: string
}

/** Copies one complete template (an example's `template/`) and names the package. */
export const scaffoldFromTemplate = ({
  projectName,
  targetDir,
  templateDir,
}: ScaffoldFromTemplateOptions): string[] => {
  const written = copyTree(templateDir, targetDir)
  const manifestPath = path.join(targetDir, 'package.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`template has no package.json: ${templateDir}`)
  }
  writeJson(manifestPath, finalizeManifest(readJson(manifestPath), projectName))
  return written
}

export interface ScaffoldOptions {
  projectName: string
  targetDir: string
  scaffoldDir: string
  tier: Tier
}

/** The starter app, then the DAML tooling when it has a `daml/`, then the localnet layer. */
export const scaffold = ({
  projectName,
  targetDir,
  scaffoldDir,
  tier,
}: ScaffoldOptions): string[] => {
  const written = copyTree(path.join(scaffoldDir, 'starter'), targetDir)
  const hasContract = fs.existsSync(path.join(targetDir, 'daml', 'daml.yaml'))
  const layers = [
    ...(hasContract ? ['daml-tooling'] : []),
    ...(tier === 'localnet' ? ['localnet'] : []),
  ]
  const added = layers.flatMap((layer) => applyFragment(path.join(scaffoldDir, layer), targetDir))
  const manifestPath = path.join(targetDir, 'package.json')
  writeJson(manifestPath, finalizeManifest(readJson(manifestPath), projectName))
  return [...written, ...added]
}
