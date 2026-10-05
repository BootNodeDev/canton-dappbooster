// A tier fragment may add files and merge these fields; it may never rewrite what the base wrote.
// A conflict is a design error in the templates, so it throws rather than picking a winner.

export const APPENDABLE = new Set(['.gitignore', '.env.example', 'README.md'])

const MERGED_FIELDS = ['scripts', 'dependencies', 'devDependencies'] as const

type Manifest = Record<string, unknown>
type Field = Record<string, string>

export class TemplateConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateConflictError'
  }
}

const sorted = (field: Field): Field =>
  Object.fromEntries(Object.entries(field).sort(([a], [b]) => a.localeCompare(b)))

const mergeField = (name: string, base: Field, fragment: Field): Field => {
  const clash = Object.keys(fragment).filter((key) => key in base)
  if (clash.length > 0) {
    throw new TemplateConflictError(`fragment redefines ${name}: ${clash.join(', ')}`)
  }
  return { ...base, ...fragment }
}

export const mergeManifests = (base: Manifest, fragment: Manifest): Manifest => {
  const merged: Manifest = { ...base }
  for (const field of MERGED_FIELDS) {
    const fromBase = (base[field] ?? {}) as Field
    const fromFragment = (fragment[field] ?? {}) as Field
    if (Object.keys(fromFragment).length === 0) {
      continue
    }
    const combined = mergeField(field, fromBase, fromFragment)
    merged[field] = field === 'scripts' ? combined : sorted(combined)
  }
  return merged
}

export const finalizeManifest = (manifest: Manifest, projectName: string): Manifest => {
  const { name: _name, private: _private, version: _version, ...rest } = manifest
  return { name: projectName, private: true, version: '0.0.0', ...rest }
}
