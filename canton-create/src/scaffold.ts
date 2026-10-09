import fs from 'node:fs'
import path from 'node:path'
import {
  APPENDABLE,
  finalizeManifest,
  mergeEnvExample,
  mergeManifests,
  ScaffoldConflictError,
} from '#src/merge'

// npm drops a `.gitignore` from every tarball it packs, and a `pnpm-workspace.yaml` inside the
// monorepo would make pnpm treat the app as its own workspace root, so both travel renamed.
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

export const hasContract = (dir: string): boolean =>
  fs.existsSync(path.join(dir, 'daml', 'daml.yaml'))

export interface ScaffoldOptions {
  projectName: string
  targetDir: string
  appDir: string
  scaffoldDir: string
  localnet: boolean
}

/** The app (the starter or an example), then the DAML tooling when it has a contract, then the local network. */
export const scaffold = ({
  projectName,
  targetDir,
  appDir,
  scaffoldDir,
  localnet,
}: ScaffoldOptions): string[] => {
  const written = copyTree(appDir, targetDir)
  const manifestPath = path.join(targetDir, 'package.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`the app has no package.json: ${appDir}`)
  }
  const layers = [
    ...(hasContract(targetDir) ? ['daml-tooling'] : []),
    ...(localnet ? ['localnet'] : []),
  ]
  const added = layers.flatMap((layer) => applyFragment(path.join(scaffoldDir, layer), targetDir))
  writeJson(manifestPath, finalizeManifest(readJson(manifestPath), projectName))
  return [...written, ...added]
}
