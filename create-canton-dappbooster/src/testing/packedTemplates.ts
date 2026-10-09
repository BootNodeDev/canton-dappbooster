import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface PackedTemplates {
  templatesDir: string
  remove: () => void
}

/** Packs the CLI as npm would publish it, so a test scaffolds from what `files` ships. */
export const packTemplates = (): PackedTemplates => {
  const packed = fs.mkdtempSync(path.join(os.tmpdir(), 'create-canton-dappbooster-packed-'))
  const packageDir = path.resolve(import.meta.dirname, '..', '..')
  const args = ['pack', packageDir, '--pack-destination', packed, '--json', '--ignore-scripts']
  const [{ filename }] = JSON.parse(execFileSync('npm', args, { encoding: 'utf8' })) as {
    filename: string
  }[]
  execFileSync('tar', ['-xzf', path.join(packed, filename), '-C', packed])
  return {
    templatesDir: path.join(packed, 'package', 'templates'),
    remove: () => fs.rmSync(packed, { recursive: true, force: true }),
  }
}
