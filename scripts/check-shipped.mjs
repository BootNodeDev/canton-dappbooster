// Verifies what a consumer actually installs, per package: every exports entry resolves to a
// built file, peers stay external instead of inlined, and the shipped declarations keep their
// JSDoc. Runs after `pnpm build`; see issue #59. Tested by check-shipped.test.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, resolve } from 'node:path'

// Per-entry byte budget: the cheapest inlining tripwire (a bundled React is ~140 kB on its own).
export const DEFAULT_BUDGET_KB = 64

const NODE_BUILTINS = new Set(builtinModules)

export const workspaceDirs = (root) => {
  const yaml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
  const packagesBlock = yaml.split(/^packages:\s*$/m)[1] ?? ''

  return packagesBlock
    .split('\n')
    .map((line) => line.match(/^\s+-\s+(\S+)\s*$/)?.[1])
    .filter((dir) => dir !== undefined)
}

// A package qualifies when it both declares an exports map and builds an artifact to back it.
export const shouldCheck = (manifest) =>
  manifest !== undefined && manifest.exports !== undefined && manifest.scripts?.build !== undefined

// Normalizes the exports field to { "." | "./sub": { condition: target } }.
export const entriesOf = (exportsField) => {
  if (typeof exportsField === 'string') {
    return { '.': { default: exportsField } }
  }

  const keys = Object.keys(exportsField)
  if (keys.every((key) => key.startsWith('.'))) {
    return exportsField
  }

  return { '.': exportsField }
}

// The package name segment of a bare specifier ("@scope/pkg/deep" -> "@scope/pkg").
export const packageNameOf = (specifier) => {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

export const bareImportsOf = (source) => {
  const specifiers = new Set()
  const patterns = [
    /^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        continue
      }
      if (specifier.startsWith('node:') || NODE_BUILTINS.has(packageNameOf(specifier))) {
        continue
      }
      specifiers.add(packageNameOf(specifier))
    }
  }

  return specifiers
}

// Both shapes ship: .js carries the runtime imports, .d.ts the type-only ones (a peer used only
// for types is still a peer a consumer must install).
const distFilesOf = (pkgDir, subdir = 'dist') => {
  const distPath = join(pkgDir, subdir)
  if (!existsSync(distPath)) {
    return []
  }

  return readdirSync(distPath, { recursive: true, withFileTypes: true })
    .filter(
      (dirent) => dirent.isFile() && (dirent.name.endsWith('.js') || dirent.name.endsWith('.d.ts')),
    )
    .map((dirent) => join(dirent.parentPath, dirent.name))
}

// Resolution as a real consumer sees it: node inside the package resolves the package's own name,
// so a broken map, a missing file, or a dev-only condition leaking into `import` all surface here.
export const resolveAsConsumer = (pkgDir, specifier) => {
  try {
    return execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
      ],
      { cwd: pkgDir, encoding: 'utf8' },
    ).trim()
  } catch {
    return undefined
  }
}

// Returns failure strings, each naming the entry and the problem; empty means the package ships.
// `entries` carries what was verified, so the caller can show its work.
export const checkPackage = (pkgDir, manifest, budgetOverrides = {}) => {
  const failures = []
  const verified = []
  const pkg = manifest.name
  const entries = entriesOf(manifest.exports)

  const fail = (entry, message) => {
    failures.push(`${pkg} ${entry}: ${message}`)
  }

  const dependencies = Object.keys(manifest.dependencies ?? {})
  const peers = Object.keys(manifest.peerDependencies ?? {})
  const optionalPeers = peers.filter(
    (peer) => manifest.peerDependenciesMeta?.[peer]?.optional === true,
  )
  const allowedExternals = new Set([...dependencies, ...peers])
  const requiredExternals = peers.filter((peer) => !optionalPeers.includes(peer))

  for (const [entry, conditions] of Object.entries(entries)) {
    const targets = typeof conditions === 'string' ? { default: conditions } : conditions

    // Every shipped condition must point at a file that exists ("development" ships nothing).
    for (const [condition, target] of Object.entries(targets)) {
      if (condition === 'development') {
        continue
      }
      if (typeof target === 'string' && !existsSync(join(pkgDir, target))) {
        fail(entry, `"${condition}" points at ${target}, which does not exist — build first?`)
      }
    }

    const importTarget = targets.import ?? targets.default
    if (typeof importTarget !== 'string') {
      fail(entry, 'has no "import" or "default" condition — consumers cannot import it')
      continue
    }

    const specifier = entry === '.' ? pkg : `${pkg}/${entry.slice(2)}`
    const resolved = resolveAsConsumer(pkgDir, specifier)
    if (resolved === undefined) {
      fail(entry, `"${specifier}" does not resolve from a consumer's import`)
    } else if (!resolved.endsWith(importTarget.replace('./', '/'))) {
      fail(entry, `resolves to ${resolved}, not the "import" target ${importTarget}`)
    }

    const importPath = join(pkgDir, importTarget)
    if (existsSync(importPath)) {
      const budgetKb = budgetOverrides[`${pkg} ${entry}`] ?? DEFAULT_BUDGET_KB
      const sizeKb = statSync(importPath).size / 1024
      if (sizeKb > budgetKb) {
        fail(
          entry,
          `${importTarget} is ${sizeKb.toFixed(1)} kB, over the ${budgetKb} kB budget — inlined dependency?`,
        )
      }
    }

    // Wholesale-stripped docs shipped once; declarations with exports but zero doc blocks fail.
    const typesTarget = targets.types
    const docBlocks =
      typeof typesTarget === 'string' && existsSync(join(pkgDir, typesTarget))
        ? (readFileSync(join(pkgDir, typesTarget), 'utf8').match(/\/\*\*/g) ?? []).length
        : undefined
    if (docBlocks === 0) {
      const declarations = readFileSync(join(pkgDir, typesTarget), 'utf8')
      if (/\bexport\b/.test(declarations)) {
        fail(entry, `${typesTarget} exports symbols but carries no JSDoc — stripped by the build?`)
      }
    }

    verified.push({
      entry,
      importTarget,
      sizeKb: existsSync(importPath) ? statSync(importPath).size / 1024 : undefined,
      docBlocks,
    })
  }

  // Peers must survive as import statements; an inlined peer leaves no specifier behind.
  const bareImports = new Set()
  for (const file of distFilesOf(pkgDir)) {
    for (const specifier of bareImportsOf(readFileSync(file, 'utf8'))) {
      bareImports.add(specifier)
    }
  }

  for (const specifier of bareImports) {
    if (!allowedExternals.has(specifier)) {
      fail('dist', `imports "${specifier}", which is not a declared dependency or peer`)
    }
  }

  for (const peer of requiredExternals) {
    if (!bareImports.has(peer)) {
      fail('dist', `peer "${peer}" never appears as an import — inlined into the bundle?`)
    }
  }

  return { failures, entries: verified, externals: [...bareImports].sort() }
}

const skipReason = (manifest) => {
  if (manifest.exports === undefined) {
    return 'no exports map'
  }
  return 'no build script'
}

const main = () => {
  const root = resolve(import.meta.dirname, '..')
  const allFailures = []
  const skipped = []
  const checkedCount = { packages: 0, entries: 0 }

  for (const dir of workspaceDirs(root)) {
    const manifestPath = join(root, dir, 'package.json')
    if (!existsSync(manifestPath)) {
      continue
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (!shouldCheck(manifest)) {
      skipped.push(`${dir} (${skipReason(manifest)})`)
      continue
    }

    const { failures, entries, externals } = checkPackage(join(root, dir), manifest)
    allFailures.push(...failures)
    checkedCount.packages += 1
    checkedCount.entries += entries.length

    console.log(manifest.name)
    for (const { entry, importTarget, sizeKb, docBlocks } of entries) {
      const size = sizeKb === undefined ? 'missing!' : `${sizeKb.toFixed(1)} kB`
      const docs = docBlocks === undefined ? 'no d.ts' : `${docBlocks} JSDoc blocks`
      console.log(`  ${entry} -> ${importTarget} (${size}, ${docs})`)
    }
    console.log(`  externals: ${externals.join(', ') || 'none'}`)
  }

  if (skipped.length > 0) {
    console.log('skipped:')
    for (const entry of skipped) {
      console.log(`  ${entry}`)
    }
  }

  if (checkedCount.packages === 0) {
    console.error('check-shipped: no package with an exports map and a build script was found')
    process.exit(1)
  }

  if (allFailures.length > 0) {
    console.error(`\ncheck-shipped: ${allFailures.length} problem(s)`)
    for (const failure of allFailures) {
      console.error(`  FAIL ${failure}`)
    }
    process.exit(1)
  }

  console.log(
    `check-shipped: ${checkedCount.packages} package(s), ${checkedCount.entries} entries — every entry resolves, peers stay external, JSDoc shipped`,
  )
}

if (import.meta.main) {
  main()
}
