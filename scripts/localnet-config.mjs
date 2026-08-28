#!/usr/bin/env node
//
// Scaffolds the LocalNet directory and applies the two flags this stack cannot run
// without, so nothing about it is committed or hand-edited.
//
// `canton-barebones init` copies its templates and never overwrites, which leaves a
// scaffolded config frozen at whatever the tool shipped the day it ran. That matters
// twice: a config-format bump makes every command fail, and a Splice tag bump would
// otherwise leave the tool running against a version it was not tested with. So the
// local copy is re-scaffolded whenever the installed template moves past it, and the
// flags are re-applied on top. Anything else a developer sets there survives until
// then; a standing deviation belongs in a directory of its own, via CANTON_LOCALNET_DIR.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

const CONFIG_NAME = 'canton-barebones.config.json'

// nginx serves no /api/validator without appUser.ui and no /api/scan without sv.scanUI,
// which is how a missing flag surfaces as wallet-service failing for unrelated reasons.
const REQUIRED_FLAGS = [
  ['validators', 'appUser', 'ui'],
  ['sv', 'scanUI'],
]

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

/**
 * Decides whether the scaffolded config has to be replaced rather than kept. Absent
 * or off the template's config version or Splice tag, it is replaced; anything else
 * a developer set there is theirs to keep.
 */
export const needsRescaffold = (local, template) => {
  if (local === undefined) {
    return 'missing'
  }
  if (local.version !== template.version) {
    return `config version ${local.version ?? 'missing'} -> ${template.version}`
  }
  if (local.splice?.tag !== template.splice?.tag) {
    return `Splice tag ${local.splice?.tag ?? 'missing'} -> ${template.splice?.tag}`
  }
  return undefined
}

/**
 * Sets each required flag to true, returning whether anything changed. Throws when a
 * flag's path is gone, because silently skipping it is the failure this exists to stop.
 */
export const applyRequiredFlags = (config) => {
  let changed = false
  for (const keyPath of REQUIRED_FLAGS) {
    const parent = keyPath.slice(0, -1).reduce((node, key) => node?.[key], config)
    const leaf = keyPath.at(-1)
    if (parent === undefined || !(leaf in parent)) {
      throw new Error(
        `${keyPath.join('.')} is not in the canton-barebones template any more. ` +
          'Update REQUIRED_FLAGS in scripts/localnet-config.mjs to match the new config shape.',
      )
    }
    if (parent[leaf] !== true) {
      parent[leaf] = true
      changed = true
    }
  }
  return changed
}

const main = () => {
  const targetDir = process.argv[2]
  if (targetDir === undefined) {
    throw new Error('Usage: node scripts/localnet-config.mjs <localnet-dir>')
  }

  const templatePath = require.resolve(`@bootnodedev/canton-barebones/templates/${CONFIG_NAME}`)
  const template = readJson(templatePath)
  const configPath = path.join(targetDir, CONFIG_NAME)

  fs.mkdirSync(targetDir, { recursive: true })
  const local = fs.existsSync(configPath) ? readJson(configPath) : undefined
  const reason = needsRescaffold(local, template)

  // Driving `init` rather than copying the templates here keeps the tool the authority
  // on which files a scaffold is made of.
  if (reason !== undefined) {
    const bin = require.resolve('@bootnodedev/canton-barebones/bin/canton-barebones.js')
    const args = local === undefined ? ['init'] : ['init', '--force']
    execFileSync(process.execPath, [bin, ...args], { cwd: targetDir, stdio: 'ignore' })
    console.log(`localnet-config: scaffolded ${targetDir} (${reason})`)
  }

  const config = readJson(configPath)
  if (applyRequiredFlags(config)) {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    console.log(`localnet-config: applied ${REQUIRED_FLAGS.map((k) => k.join('.')).join(', ')}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
