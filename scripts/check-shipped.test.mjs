import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import {
  bareImportsOf,
  checkPackage,
  entriesOf,
  packageNameOf,
  shouldCheck,
  workspaceDirsOf,
} from './check-shipped.mjs'

describe('workspaceDirsOf', () => {
  it('collects exactly the packages block, through blanks and comments', () => {
    const yaml = [
      'packages:',
      '  - canton-dappbooster',
      '',
      '  # a comment between items',
      '  - dapp/frontend',
      '',
      '# top-level comment ends the block',
      'overrides:',
      "  '@scope/pkg': 1.0.0",
      'someFutureList:',
      '  - not-a-package',
    ].join('\n')
    assert.deepEqual(workspaceDirsOf(yaml), ['canton-dappbooster', 'dapp/frontend'])
  })

  it('returns nothing without a packages block', () => {
    assert.deepEqual(workspaceDirsOf('overrides:\n  x: 1\n'), [])
  })
})

describe('entriesOf', () => {
  it('wraps a string exports field as the root entry', () => {
    assert.deepEqual(entriesOf('./dist/index.js'), { '.': { default: './dist/index.js' } })
  })

  it('wraps a conditions-only object as the root entry', () => {
    assert.deepEqual(entriesOf({ import: './dist/index.js' }), {
      '.': { import: './dist/index.js' },
    })
  })

  it('passes a subpath map through', () => {
    const map = { '.': { import: './dist/index.js' }, './testing': { import: './dist/t.js' } }
    assert.deepEqual(entriesOf(map), map)
  })
})

describe('packageNameOf', () => {
  it('maps a deep import to its package', () => {
    assert.equal(packageNameOf('react/jsx-runtime'), 'react')
  })

  it('keeps the scope segment of scoped packages', () => {
    assert.equal(packageNameOf('@canton-network/dapp-sdk/dist/x'), '@canton-network/dapp-sdk')
  })
})

describe('bareImportsOf', () => {
  it('collects import, re-export, and side-effect specifiers', () => {
    const source = [
      "import { a } from 'react'",
      'export { b } from "@scope/pkg/deep"',
      "import 'polyfill'",
    ].join('\n')
    assert.deepEqual([...bareImportsOf(source)].sort(), ['@scope/pkg', 'polyfill', 'react'])
  })

  it('ignores relative paths and node builtins', () => {
    const source = ["import { x } from './local'", "import { y } from 'node:fs'", "import { z } from 'path'"].join(
      '\n',
    )
    assert.deepEqual([...bareImportsOf(source)], [])
  })
})

describe('shouldCheck', () => {
  it('requires both an exports map and a build script', () => {
    assert.equal(shouldCheck({ exports: {}, scripts: { build: 'tsdown' } }), true)
    assert.equal(shouldCheck({ exports: {} }), false)
    assert.equal(shouldCheck({ scripts: { build: 'tsdown' } }), false)
    assert.equal(shouldCheck(undefined), false)
  })
})

describe('checkPackage', () => {
  const roots = []

  const fixture = (manifest, files) => {
    const dir = mkdtempSync(join(tmpdir(), 'check-shipped-'))
    roots.push(dir)

    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2))
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true })
      writeFileSync(join(dir, path), content)
    }

    return dir
  }

  after(() => {
    for (const dir of roots) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  const manifestBase = {
    name: '@fixture/pkg',
    scripts: { build: 'tsdown' },
    peerDependencies: { react: '^19.0.0' },
    exports: {
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    },
  }

  const docdTypes = '/** Doc. */\nexport declare const a: number\n'

  it('passes a clean package', () => {
    const dir = fixture(manifestBase, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifestBase)
    assert.deepEqual(failures, [])
  })

  it('names a condition whose target file is missing', () => {
    const dir = fixture(manifestBase, { 'dist/index.d.ts': docdTypes })

    const { failures } = checkPackage(dir, manifestBase)
    assert.ok(failures.some((f) => f.includes('"import" points at ./dist/index.js')))
  })

  it('accepts a peer that only the declarations import', () => {
    const manifest = {
      ...manifestBase,
      peerDependencies: { react: '^19.0.0', '@canton-network/core-types': '^1.8.0' },
    }
    const dir = fixture(manifest, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': `import type { W } from '@canton-network/core-types'\n${docdTypes}`,
    })

    const { failures } = checkPackage(dir, manifest)
    assert.deepEqual(failures, [])
  })

  it('flags a required peer that appears nowhere in the output', () => {
    const dir = fixture(manifestBase, {
      'dist/index.js': 'export const a = 1\n',
      'dist/index.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifestBase)
    assert.ok(failures.some((f) => f.includes('peer "react" never appears')))
  })

  it('lets an optional peer stay absent', () => {
    const manifest = {
      ...manifestBase,
      peerDependencies: { react: '^19.0.0', '@walletconnect/sign-client': '^2.0.0' },
      peerDependenciesMeta: { '@walletconnect/sign-client': { optional: true } },
    }
    const dir = fixture(manifest, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifest)
    assert.deepEqual(failures, [])
  })

  it('flags an undeclared bare import in the output', () => {
    const dir = fixture(manifestBase, {
      'dist/index.js': "import { useState } from 'react'\nimport { x } from 'lodash'\nexport const a = 1\n",
      'dist/index.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifestBase)
    assert.ok(failures.some((f) => f.includes('imports "lodash"')))
  })

  it('flags an entry over the size budget', () => {
    const dir = fixture(manifestBase, {
      'dist/index.js': `import { useState } from 'react'\n// ${'x'.repeat(70_000)}\nexport const a = 1\n`,
      'dist/index.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifestBase)
    assert.ok(failures.some((f) => f.includes('over the 64 kB budget')))
  })

  it('flags declarations that ship without JSDoc', () => {
    const dir = fixture(manifestBase, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': 'export declare const a: number\n',
    })

    const { failures } = checkPackage(dir, manifestBase)
    assert.ok(failures.some((f) => f.includes('no JSDoc')))
  })

  it('resolves every declared subpath as a consumer would', () => {
    const manifest = {
      ...manifestBase,
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './testing': { types: './dist/testing/index.d.ts', import: './dist/testing/index.js' },
      },
    }
    const dir = fixture(manifest, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': docdTypes,
      'dist/testing/index.js': 'export const t = 1\n',
      'dist/testing/index.d.ts': docdTypes,
    })

    const { failures, entries, externals } = checkPackage(dir, manifest)
    assert.deepEqual(
      entries.map(({ entry }) => entry),
      ['.', './testing'],
    )
    assert.deepEqual(externals, ['react'])
    assert.deepEqual(failures, [])
  })

  it('flags a subpath whose mapping is missing the import condition', () => {
    const manifest = {
      ...manifestBase,
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './broken': { types: './dist/broken.d.ts' },
      },
    }
    const dir = fixture(manifest, {
      'dist/index.js': "import { useState } from 'react'\nexport const a = useState\n",
      'dist/index.d.ts': docdTypes,
      'dist/broken.d.ts': docdTypes,
    })

    const { failures } = checkPackage(dir, manifest)
    assert.ok(failures.some((f) => f.includes('no "import" or "default" condition')))
  })
})
