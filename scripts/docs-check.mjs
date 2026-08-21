#!/usr/bin/env node
// Enforces the doc-block rules in root CLAUDE.md that typedoc cannot see: an unexported component
// is invisible to it, an example pasted onto the wrong symbol still compiles, and a doc block that
// has become an essay is valid TypeScript. Also compiles every snippet, which is the only way a
// copy-paste example stays true as the API moves under it.
//
// Description presence is typedoc's job for everything except an exported function, and the tag
// vocabulary is typedoc's outright — typedoc.shared.json is the allow-list. See the Doc blocks
// section of root CLAUDE.md for both splits.
//
// Usage: node scripts/docs-check.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createGate, repoRoot } from './lib/gate.mjs'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

// Every list is read rather than restated: a package or an entry point added to the reference
// would otherwise render on the site while escaping every check here, and a category invented here
// would disagree with the one typedoc sorts by.
const PACKAGES = readJson(path.join(repoRoot, 'typedoc.json')).entryPoints.map((dir) => {
  const config = readJson(path.join(repoRoot, dir, 'typedoc.json'))
  return {
    dir,
    barrels: config.entryPoints,
    categories: new Set((config.categoryOrder ?? []).filter((name) => name !== '*')),
    componentsDir: existsSync(path.join(repoRoot, dir, 'src/components'))
      ? 'src/components'
      : undefined,
  }
})

const MAX_COLUMNS = 100
const EXAMPLE_LINE_CAP = 8
const MAX_EXAMPLES = 2
const MARKDOWN_DOCS = ['README.md', 'architecture.md']
const FIXTURES = 'doc-fixtures.d.ts'
const PROBE_DIR = '__doc-probe__'

// Ceilings, not targets — the table in root CLAUDE.md is the target. See the Doc blocks section.
const PROSE_CAP = { component: 6, hook: 4, util: 6, config: 4, props: 3, result: 3, value: 3 }
const NEEDS_EXAMPLE = new Set(['component', 'hook', 'util', 'config'])

const { report, finish } = createGate('docs-check')

/* Tiers */

const returnsElement = (node) => {
  const type = node.type ?? node.initializer?.type
  if (type === undefined) return false
  const text = type.getText()
  return text.includes('ReactElement') || text.includes('JSX.Element')
}

const callableOf = (node) => {
  if (ts.isFunctionDeclaration(node)) return node
  if (!ts.isVariableDeclaration(node)) return undefined
  const init = node.initializer
  return init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
    ? init
    : undefined
}

// A status union and a result type land in the same tier, so no separate union test is needed:
// anything not named for props or for config falls through to `result`.
const tierOf = (name, node) => {
  const callable = callableOf(node)
  if (callable !== undefined) {
    if (returnsElement(callable) || returnsElement(node)) return 'component'
    if (/^use[A-Z]/.test(name)) return 'hook'
    return 'util'
  }
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    if (name.endsWith('Props')) return 'props'
    if (/(Config|Options|Params)$/.test(name)) return 'config'
    return 'result'
  }
  if (ts.isClassDeclaration(node)) return 'result'
  return 'value'
}

/* Doc block parsing */

const docOf = (node) => {
  const owner = ts.isVariableDeclaration(node) ? (node.parent?.parent ?? node) : node
  const blocks = ts.getJSDocCommentsAndTags(owner).filter(ts.isJSDoc)
  return blocks.length === 0 ? undefined : blocks[blocks.length - 1]
}

// Strips the comment furniture so a line count means content lines rather than asterisks.
const parseDoc = (sourceFile, doc) => {
  const raw = sourceFile.text.slice(doc.pos, doc.end)
  const startLine = sourceFile.getLineAndCharacterOfPosition(doc.pos).line
  const prose = []
  const examples = []
  const tags = []
  let current

  raw.split('\n').forEach((rawLine, offset) => {
    const body = rawLine
      .replace(/^\s*\/\*\*+/, '')
      .replace(/\s*\*\/\s*$/, '')
      .replace(/^\s*\*/, '')
      .replace(/^ /, '')
    const trimmed = body.trim()
    const line = startLine + offset + 1
    const tag = /^@(\w+)/.exec(trimmed)

    if (tag !== null) {
      const entry = { name: tag[1], body: trimmed.slice(tag[0].length).trim(), line }
      tags.push(entry)
      // A tag's continuation lines belong to the tag, not to the description: a wrapped @throws
      // counted as prose would push a block over its tier's ceiling for saying one thing.
      current = tag[1] === 'example' ? { line, lines: [] } : entry
      if (tag[1] === 'example') examples.push(current)
      return
    }
    if (trimmed === '') return
    if (current === undefined) prose.push({ text: body, line })
    else if (current.lines !== undefined) current.lines.push({ text: body, line })
    else current.body = `${current.body} ${trimmed}`
  })

  return { raw, prose, examples, tags, internal: /(^|\s)@internal(\s|$)/.test(raw) }
}

/* Barrel exports */

const exportedNames = (sourceFile) => {
  const names = new Set()
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue
    if (!ts.isNamedExports(statement.exportClause)) continue
    for (const element of statement.exportClause.elements) names.add(element.name.text)
  }
  return names
}

/* Snippet compilation (§5.4 of the plan: the details that cost the most to rediscover) */

// Strings and line comments go first, or a bracket inside either would be counted.
const bracketDelta = (text) => {
  const code = text.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''").replace(/\/\/.*$/, '')
  const count = (pattern) => (code.match(pattern) ?? []).length
  return count(/[([{]/g) - count(/[)\]}]/g)
}

const wrapSnippet = (lines, injectedImport) => {
  const imports = []
  const body = []
  // An import statement can span lines, and its tail must not land in the wrapper body: an import
  // is illegal inside a function.
  let inImport = false
  let importDepth = 0
  for (const line of lines) {
    if (!inImport && /^\s*import\b/.test(line.text)) inImport = true
    if (!inImport) {
      body.push(line)
      continue
    }
    imports.push(line)
    importDepth += bracketDelta(line.text)
    if (importDepth <= 0 && /['"]/.test(line.text)) {
      inImport = false
      importDepth = 0
    }
  }

  const out = []
  const map = new Map()
  const push = (text, origin) => {
    out.push(text)
    if (origin !== undefined) map.set(out.length, origin)
  }

  for (const line of imports) push(line.text, line)
  if (injectedImport !== undefined && imports.length === 0) push(injectedImport)
  // A function body accepts statements, bare JSX and await alike; not exported, or
  // isolatedDeclarations would demand a return type on the wrapper.
  push('async function example() {')

  for (const line of body) {
    // The repo has no semicolons, so a line opening a statement with `<` parses as a comparison
    // against whatever the line above evaluated to. This was most of the prototype's false
    // diagnostics, including ones as misleading as "Property 'state' does not exist on Boolean".
    // Column zero is what separates such a statement from a JSX child, which is always indented.
    const starts = line.text.startsWith('<') && !line.text.startsWith('</')
    push(starts ? `;${line.text}` : line.text, line)
  }

  push('}')
  push('void example')

  return { text: `${out.join('\n')}\n`, map }
}

const compileSnippets = (pkg, snippets) => {
  const pkgDir = path.join(repoRoot, pkg.dir)
  const options = {
    ...tsconfigOf(pkgDir).options,
    declaration: false,
    isolatedDeclarations: false,
    noEmit: true,
    skipLibCheck: true,
  }

  const overlay = new Map()
  const roots = []
  const fixtures = path.join(pkgDir, FIXTURES)
  if (existsSync(fixtures)) roots.push(fixtures)

  snippets.forEach((snippet, index) => {
    const file = path.join(pkgDir, PROBE_DIR, `snippet-${index}.tsx`)
    const wrapped = wrapSnippet(snippet.lines, snippet.injectedImport)
    overlay.set(path.normalize(file), wrapped.text)
    snippet.probe = { file, map: wrapped.map }
    roots.push(file)
  })

  if (roots.length === 0) return

  // An overlay rather than files on disk: the virtual path has to sit inside the package so the
  // nearest package.json — and with it `#src/*` — is the package's own.
  // Only readFile needs patching: the host builds getSourceFile over its own readFile, and infers
  // the script kind from the extension, which `.tsx` already gives it.
  const host = ts.createCompilerHost(options, true)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  host.readFile = (name) => overlay.get(path.normalize(name)) ?? readFile(name)
  host.fileExists = (name) => overlay.has(path.normalize(name)) || fileExists(name)

  const program = ts.createProgram(roots, options, host)

  for (const snippet of snippets) {
    const sourceFile = program.getSourceFile(snippet.probe.file)
    if (sourceFile === undefined) continue
    const diagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ]
    for (const diagnostic of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
      const probeLine =
        diagnostic.start === undefined
          ? 0
          : sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1
      const origin = snippet.probe.map.get(probeLine)
      report(
        snippet.file,
        origin?.line ?? snippet.line,
        `snippet for ${snippet.owner} does not compile: ${message} (TS${diagnostic.code})`,
      )
    }
  }
}

/* Markdown fences */

const markdownSnippets = (pkg) => {
  const snippets = []
  for (const doc of MARKDOWN_DOCS) {
    const file = path.join(repoRoot, pkg.dir, doc)
    if (!existsSync(file)) continue

    let open
    let fenced = false
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, index) => {
        const fence = /^( {0,3})```(\w*)/.exec(text)
        if (fence !== null) {
          if (fenced) {
            if (open !== undefined) {
              snippets.push({ line: open.line, lines: open.lines, file, owner: `${doc} fence` })
            }
            open = undefined
            fenced = false
            return
          }
          fenced = true
          // Indented with its fence, or a statement in it would not sit at column zero.
          if (fence[2] === 'ts' || fence[2] === 'tsx') {
            open = { line: index + 2, lines: [], indent: fence[1].length }
          }
          return
        }
        open?.lines.push({ text: text.slice(open.indent), line: index + 1 })
      })
  }
  return snippets
}

/* Source walk */

const tsconfigOf = (pkgDir) =>
  ts.parseJsonConfigFileContent(
    ts.readConfigFile(path.join(pkgDir, 'tsconfig.json'), ts.sys.readFile).config,
    ts.sys,
    pkgDir,
  )

// Nothing here asks for a type, so a parse is the whole job — a Program would resolve the module
// graph and lib.d.ts to be used as a source-file lookup. The `true` is setParentNodes, which is
// what getJSDocCommentsAndTags and getText walk.
const parseFile = (file) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true)

const checkPackage = (pkg) => {
  const pkgDir = path.join(repoRoot, pkg.dir)
  const files = tsconfigOf(pkgDir).fileNames.filter((file) => /\.tsx?$/.test(file))
  const parsedFiles = new Map(files.map((file) => [file, parseFile(file)]))

  const barrelExports = new Map()
  const allBarrelNames = new Set()
  for (const barrel of pkg.barrels) {
    const sourceFile = parsedFiles.get(path.join(pkgDir, barrel))
    if (sourceFile === undefined) continue
    const names = exportedNames(sourceFile)
    barrelExports.set(barrel, names)
    for (const name of names) allBarrelNames.add(name)
  }

  const declarations = new Map()
  const snippets = []
  const barrelImport = pkg.barrels
    .map((barrel) => {
      const names = [...(barrelExports.get(barrel) ?? [])].sort()
      const specifier = `#${barrel.replace(/\.tsx?$/, '')}`
      return names.length === 0 ? '' : `import { ${names.join(', ')} } from '${specifier}'`
    })
    .filter(Boolean)
    .join('\n')

  // `#src/*` maps to `./src/*`, so the four candidates are what tsc walks for one key. Only the
  // throws hop needs this, and it wants the parsed file rather than the resolved specifier.
  const resolveModule = (specifier) => {
    const base = path.join(pkgDir, specifier.slice(1))
    for (const candidate of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const found = parsedFiles.get(`${base}${candidate}`)
      if (found !== undefined) return found
    }
    return undefined
  }

  // A snippet sees the whole public surface plus whatever its own module exports, so an @internal
  // component's example still resolves the component it documents.
  const importsFor = (file, localExports) => {
    const own = [...localExports].filter((name) => !allBarrelNames.has(name)).sort()
    if (own.length === 0) return barrelImport
    const specifier = `#${path
      .relative(pkgDir, file)
      .replace(/\\/g, '/')
      .replace(/\.tsx?$/, '')
      .replace(/\/index$/, '')}`
    return `${barrelImport}\nimport { ${own.join(', ')} } from '${specifier}'`
  }

  for (const [file, sourceFile] of parsedFiles) {
    checkCommentWidth(sourceFile)

    const localExports = new Set()
    const found = []
    const visit = (node) => {
      for (const { name, declaration } of namedDeclarations(node)) {
        if (isExported(node)) localExports.add(name)
        found.push({ name, node: declaration, sourceFile, file })
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    for (const entry of found) {
      declarations.set(`${file}::${entry.name}`, { ...entry, localExports })
    }
  }

  for (const entry of declarations.values()) {
    const { name, node, sourceFile, file } = entry
    const doc = docOf(node)
    const inBarrel = allBarrelNames.has(name)
    if (doc === undefined) {
      if (inBarrel && callableOf(node) !== undefined) {
        report(file, lineOf(sourceFile, node), `${name} is exported but carries no doc block`)
      }
      continue
    }

    const parsed = parseDoc(sourceFile, doc)
    if (!inBarrel && !isComponentEntry(pkg, file, name)) continue

    const tier = tierOf(name, node)
    const callable = callableOf(node)
    const category = parsed.tags.find((tag) => tag.name === 'category')
    if (inBarrel && category === undefined) {
      // Untagged, a new export falls into typedoc's TypeScript-kind buckets, so the reference goes
      // back to listing every interface together — which is what the groups exist to replace.
      report(file, lineOf(sourceFile, node), `${name} carries no @category`)
    } else if (category !== undefined && !pkg.categories.has(category.body)) {
      const known = [...pkg.categories].join(', ')
      report(file, category.line, `${name}: @category ${category.body} is not one of ${known}`)
    }
    checkTags(file, name, parsed, tier, callable, allBarrelNames)
    checkProse(file, name, tier, parsed, callable !== undefined)
    checkExamples(file, name, tier, parsed, entry.localExports)
    checkThrows(file, name, tier, parsed, callable, throwersFor(sourceFile, resolveModule))
    checkAnatomyLink(file, name, tier, parsed)

    for (const example of parsed.examples) {
      if (example.lines.length > 0) {
        snippets.push({
          file,
          line: example.line,
          owner: name,
          lines: example.lines,
          injectedImport: importsFor(file, entry.localExports),
        })
      }
    }
  }

  checkBarrelCompleteness(pkg, pkgDir, declarations, allBarrelNames)
  checkPropsBesideComponent(declarations, allBarrelNames)

  compileSnippets(pkg, [
    ...snippets,
    ...markdownSnippets(pkg).map((snippet) => ({ ...snippet, injectedImport: undefined })),
  ])
}

const lineOf = (sourceFile, node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

const isExported = (node) =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true

const namedDeclarations = (node) => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) => ({ name: declaration.name.text, declaration }))
  }
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name !== undefined
  ) {
    return [{ name: node.name.text, declaration: node }]
  }
  return []
}

const isComponentEntry = (pkg, file, name) =>
  pkg.componentsDir !== undefined && file.endsWith(path.join(pkg.componentsDir, name, 'index.tsx'))

/* Individual checks */

const checkCommentWidth = (sourceFile) => {
  const lines = sourceFile.text.split('\n')
  let inJsDoc = false
  lines.forEach((text, index) => {
    if (/^\s*\/\*\*/.test(text)) inJsDoc = true
    const exempt = inJsDoc
    if (inJsDoc && text.includes('*/')) inJsDoc = false
    if (exempt) return
    if (text.length <= MAX_COLUMNS) return
    if (!/^\s*(\/\/|\/\*|\*)/.test(text)) return
    report(
      sourceFile.fileName,
      index + 1,
      `comment line is ${text.length} columns; wrap at ${MAX_COLUMNS}`,
    )
  })
}

const TYPE_WORDS = /^(a|an|the|of|to|for|and|or|is|this|that|it|its|as)$/

const checkTags = (file, name, parsed, tier, callable, allBarrelNames) => {
  for (const tag of parsed.tags) {
    if (/^(param|returns|type|typedef)$/.test(tag.name) && tag.body.startsWith('{')) {
      const message = `@${tag.name} carries a {type} brace; TypeScript owns the type`
      report(file, tag.line, `${name}: ${message}`)
    }
    if (!/^(param|returns)$/.test(tag.name)) continue
    // A @param's first token is the parameter name, so only the prose after it counts as prose.
    const prose = tag.name === 'param' ? tag.body.replace(/^\S+\s*/, '') : tag.body
    const words = prose
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z]/g, '').toLowerCase())
      .filter((word) => word !== '' && !TYPE_WORDS.test(word))
    if (words.length === 0) {
      report(file, tag.line, `${name}: @${tag.name} says nothing the type does not; drop it`)
    }
  }

  if (callable === undefined) return
  const returnType = callable.type?.getText().trim()
  for (const tag of parsed.tags) {
    if (tag.name === 'param' && callable.parameters.length === 0) {
      report(file, tag.line, `${name}: @param on a callable that takes none`)
    }
    if (tag.name !== 'returns') continue
    if (tier === 'hook') {
      report(file, tag.line, `${name}: @returns on a hook; its result type is the return contract`)
    } else if (returnType !== undefined && allBarrelNames.has(returnType)) {
      report(file, tag.line, `${name}: @returns restates ${returnType}, itself an export`)
    }
  }
}

/* Throws */

const THROWS_TIERS = new Set(['hook', 'util'])
const THROWING_LOCALS = new WeakMap()

// Descends into nested closures on purpose: canton-connect's hooks throw from inside the function
// they hand back, not from the hook body, and that is still the caller's contract. A throw the
// function's own catch swallows is not, so a guarded try block is skipped — `useCopyToClipboard`
// throws `Clipboard unavailable` at itself and returns the failure as a value.
const containsThrow = (node) => {
  let found = false
  const visit = (child) => {
    if (found) return
    if (ts.isThrowStatement(child)) found = true
    else if (ts.isTryStatement(child) && child.catchClause !== undefined) {
      visit(child.catchClause)
      if (child.finallyBlock !== undefined) visit(child.finallyBlock)
    } else ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

const calledNames = (node) => {
  const names = new Set()
  const visit = (child) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
      names.add(child.expression.text)
    }
    ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return names
}

const localThrowers = (sourceFile) => {
  const cached = THROWING_LOCALS.get(sourceFile)
  if (cached !== undefined) return cached
  const names = new Set()
  for (const statement of sourceFile.statements) {
    for (const { name, declaration } of namedDeclarations(statement)) {
      const callable = callableOf(declaration)
      if (callable !== undefined && containsThrow(callable)) names.add(name)
    }
  }
  THROWING_LOCALS.set(sourceFile, names)
  return names
}

// The hop crosses a module because most of these throws do: every canton-connect hook reaches its
// guard through `useCantonConnectContext`, so stopping at the file would ask half of them for a
// @throws and let the other half past. One hop only — deeper needs a type checker, not a parse.
const throwersFor = (sourceFile, resolve) => {
  const names = new Set(localThrowers(sourceFile))
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!statement.moduleSpecifier.text.startsWith('#')) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue

    const target = resolve(statement.moduleSpecifier.text)
    if (target === undefined) continue
    const throwers = localThrowers(target)
    for (const element of bindings.elements) {
      if (throwers.has((element.propertyName ?? element.name).text)) names.add(element.name.text)
    }
  }
  return names
}

const checkThrows = (file, name, tier, parsed, callable, throwers) => {
  if (callable === undefined || !THROWS_TIERS.has(tier)) return
  if (parsed.tags.some((tag) => tag.name === 'throws')) return

  const throws =
    containsThrow(callable) || [...calledNames(callable)].some((called) => throwers.has(called))
  if (throws) {
    report(file, parsed.prose[0]?.line ?? 0, `${name} throws but carries no @throws`)
  }
}

// Conditional on the file rather than on the tier: a provider that places a selector owes the link
// as much as a component does, and one that renders no DOM has no anatomy to point at.
const checkAnatomyLink = (file, name, tier, parsed) => {
  if (tier !== 'component') return
  const anatomy = path.join(path.dirname(file), 'anatomy.ts')
  if (!existsSync(anatomy)) return

  const target = path.relative(repoRoot, anatomy).replace(/\\/g, '/')
  if (parsed.tags.some((tag) => tag.name === 'see' && tag.body.includes(target))) return
  report(file, parsed.prose[0]?.line ?? 0, `${name} has an anatomy.ts but no @see naming ${target}`)
}

const checkProse = (file, name, tier, parsed, callable) => {
  const cap = PROSE_CAP[tier]
  if (parsed.prose.length === 0) {
    // Only for a function: typedoc's requiredToBeDocumented owns every other kind, and reporting
    // both would give the rule two owners. See the Doc blocks section of root CLAUDE.md.
    if (callable) report(file, parsed.examples[0]?.line ?? 0, `${name} has tags but no description`)
    return
  }
  if (parsed.prose.length > cap) {
    report(
      file,
      parsed.prose[cap].line,
      `${name} (${tier}) has ${parsed.prose.length} prose lines; the ceiling is ${cap}`,
    )
  }
}

const checkExamples = (file, name, tier, parsed, localExports) => {
  if (parsed.examples.length === 0) {
    if (NEEDS_EXAMPLE.has(tier)) {
      report(file, parsed.prose[0]?.line ?? 0, `${name} (${tier}) needs an @example`)
    }
    return
  }
  if (parsed.examples.length > MAX_EXAMPLES) {
    report(
      file,
      parsed.examples[MAX_EXAMPLES].line,
      `${name} has ${parsed.examples.length} @example blocks; the ceiling is ${MAX_EXAMPLES}`,
    )
  }
  for (const example of parsed.examples) {
    if (example.lines.length > EXAMPLE_LINE_CAP) {
      report(
        file,
        example.lines[EXAMPLE_LINE_CAP].line,
        `${name}: @example is ${example.lines.length} lines; the ceiling is ${EXAMPLE_LINE_CAP}`,
      )
    }
  }
  if (!NEEDS_EXAMPLE.has(tier)) return

  // An example pasted onto the wrong symbol still compiles, so the only signal left is whether it
  // ever mentions the thing it documents — or something else this very file exports.
  const text = parsed.examples
    .map((example) => example.lines.map((line) => line.text).join('\n'))
    .join('\n')
  const stem = name.replace(/(Props|Result|Options|Config|Params)$/, '')
  const candidates = [name, stem, ...localExports].filter((word) => word.length > 2)
  const words = new Set((text.match(/[\w$]+/g) ?? []).map((word) => word.toLowerCase()))
  if (!candidates.some((word) => words.has(word.toLowerCase()))) {
    const line = parsed.examples[0].line
    report(file, line, `${name}: @example never names ${name} or a sibling export`)
  }
}

const checkBarrelCompleteness = (pkg, pkgDir, declarations, allBarrelNames) => {
  if (pkg.componentsDir === undefined) return
  const componentsDir = path.join(pkgDir, pkg.componentsDir)
  if (!existsSync(componentsDir)) return

  for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(componentsDir, entry.name, 'index.tsx')
    if (!existsSync(file)) {
      report(file, 0, `${entry.name}/ has no index.tsx; a component folder's entry is index.tsx`)
      continue
    }
    if (allBarrelNames.has(entry.name)) continue

    const declaration = declarations.get(`${file}::${entry.name}`)
    const doc = declaration === undefined ? undefined : docOf(declaration.node)
    if (doc === undefined || !parseDoc(declaration.sourceFile, doc).internal) {
      report(
        file,
        declaration === undefined ? 0 : lineOf(declaration.sourceFile, declaration.node),
        `${entry.name} is neither exported from a barrel nor marked @internal`,
      )
    }
  }
}

const checkPropsBesideComponent = (declarations, allBarrelNames) => {
  for (const entry of declarations.values()) {
    const { name, node, sourceFile, file } = entry
    if (!allBarrelNames.has(name)) continue
    if (tierOf(name, node) !== 'component') continue
    if (allBarrelNames.has(`${name}Props`)) continue
    report(
      file,
      lineOf(sourceFile, node),
      `${name} is exported but ${name}Props is not; a component's props are part of its API`,
    )
  }
}

/* Entry */

for (const pkg of PACKAGES) checkPackage(pkg)

finish(`${PACKAGES.map((pkg) => pkg.dir).join(', ')} clean`)
