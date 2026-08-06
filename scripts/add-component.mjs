#!/usr/bin/env node
// Scaffolds a component folder and related files.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ANSI = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m' }

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const componentsDir = path.join(repoRoot, 'canton-dappbooster/src/components')

const fail = (message) => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const name = process.argv[2]

if (!name) fail('Usage: node scripts/add-component.mjs <PascalCaseName>')
if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) fail(`"${name}" is not PascalCase. Example: ExplorerLink`)

const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const rootPart = `cnc-${kebab}`
const dir = path.join(componentsDir, name)
const rel = (p) => path.relative(repoRoot, p)

if (existsSync(dir)) fail(`${rel(dir)} already exists.`)

const files = {
  'anatomy.ts': `export const anatomy = {
  parts: {
    root: '${rootPart}',
  },
} as const
`,

  'index.tsx': `import type { HTMLAttributes, ReactElement } from 'react'
import { cx } from '../../utils/cx'
import { anatomy } from './anatomy'

/** Props for {@link ${name}}. */
export type ${name}Props = HTMLAttributes<HTMLDivElement>

/** TODO: what it does, and when to reach for it over a sibling export. */
export const ${name} = ({ children, className, ...rest }: ${name}Props): ReactElement => (
  <div {...rest} className={cx(anatomy.parts.root, className)}>
    {children}
  </div>
)
`,

  [`${name}.test.tsx`]: `import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ${name} } from '.'
import { anatomy } from './anatomy'

describe('${name}', () => {
  it('renders with the root part', () => {
    render(<${name} data-testid="${kebab}" />)
    expect(screen.getByTestId('${kebab}')).toHaveClass(anatomy.parts.root)
  })

  it('appends a consumer class to the root part', () => {
    render(<${name} className="extra" data-testid="${kebab}" />)
    expect(screen.getByTestId('${kebab}')).toHaveClass(anatomy.parts.root, 'extra')
  })
})
`,
}

mkdirSync(dir, { recursive: true })

for (const [file, contents] of Object.entries(files)) {
  writeFileSync(path.join(dir, file), contents)
  process.stdout.write(`${ANSI.green}created${ANSI.reset} ${rel(path.join(dir, file))}\n`)
}

const section = (title) => `\n${ANSI.bold}${title}${ANSI.reset}\n`

process.stdout.write(section('1. Paste into canton-dappbooster/src/index.ts:'))
process.stdout.write(`
export { ${name}, type ${name}Props } from './components/${name}'
`)

process.stdout.write(section('2. Paste into canton-theme/src/default.css, inside @layer cnc:'))
process.stdout.write(`
  .${rootPart} {
    color: var(--cnc-text, #2c2d40);
  }
`)

