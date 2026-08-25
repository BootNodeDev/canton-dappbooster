// The reporting half of every gate script, so the `file:line message` contract CI and editors parse
// has one owner rather than a copy per gate.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const createGate = (name) => {
  const findings = []
  return {
    report: (file, line, message) => {
      findings.push({ file: path.relative(repoRoot, file), line, message })
    },
    finish: (summary) => {
      findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
      for (const finding of findings) {
        process.stderr.write(`${finding.file}:${finding.line} ${finding.message}\n`)
      }
      if (findings.length > 0) {
        process.stderr.write(`\n${name}: ${findings.length} problem(s)\n`)
        process.exit(1)
      }
      process.stdout.write(`${name}: ${summary}\n`)
    },
  }
}
