#!/usr/bin/env node
// The anatomy is the L2/L3 contract, and the two sides live in different packages, so nothing but
// this compares them. It is a styling gate, not a doc one: it catches a part renamed in
// canton-dappbooster without the matching edit in canton-theme, which typechecks and passes every
// test while the component renders unstyled.
//
// Asymmetric on purpose. The theme may not select a class or a state the kit never renders —
// that is dead CSS or a typo, always. But the kit may declare a part the theme leaves alone: a
// part class is a hook a consumer can style themselves, and `cnc-identifier__status` is unstyled
// because a live region carries its own inline sr-only. What is never legitimate is a component the
// theme ignores entirely, so each anatomy object has to be reached by at least one selector.
//
// Usage: node scripts/check-anatomy.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import ts from 'typescript'
import { createGate, repoRoot } from './lib/gate.mjs'

// A provider is here because ThemeProvider writes `data-theme` to <html>: it renders no markup, but
// it does place a selector the theme keys on, so it owes an anatomy like any component.
const KIT_DIRS = ['canton-dappbooster/src/components', 'canton-dappbooster/src/providers']
const themeDir = path.join(repoRoot, 'canton-theme/src')

const { report, finish } = createGate('check-anatomy')

/* The anatomy side */

const lineOf = (node) => {
  const sourceFile = node.getSourceFile()
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

const literalEntries = (node) => {
  const entries = []
  if (node === undefined || !ts.isObjectLiteralExpression(node)) return entries
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    // Reported, not skipped: dropped silently, the theme rule for it reads as dead CSS instead.
    if (!ts.isStringLiteral(property.initializer)) {
      report(
        node.getSourceFile().fileName,
        lineOf(property),
        `${property.name.getText()} is not a string literal, so this gate cannot read it`,
      )
      continue
    }
    entries.push({ value: property.initializer.text, node: property })
  }
  return entries
}

const groupOf = (node, name) => {
  const property = ts.isObjectLiteralExpression(node)
    ? node.properties.find(
        (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText() === name,
      )
    : undefined
  return literalEntries(property?.initializer)
}

const readAnatomies = () => {
  const files = KIT_DIRS.flatMap((dir) => {
    const full = path.join(repoRoot, dir)
    return readdirSync(full, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(full, entry.name, 'anatomy.ts'))
      .filter((file) => existsSync(file))
  })

  const anatomies = []
  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TS,
    )

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue
      const exported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
      if (exported !== true) continue

      for (const declaration of statement.declarationList.declarations) {
        let initializer = declaration.initializer
        while (
          initializer !== undefined &&
          (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))
        ) {
          initializer = initializer.expression
        }
        if (initializer === undefined || !ts.isObjectLiteralExpression(initializer)) continue
        const parts = groupOf(initializer, 'parts')
        const states = groupOf(initializer, 'states')
        if (parts.length === 0 && states.length === 0) continue
        anatomies.push({ file, name: declaration.name.getText(), parts, states })
      }
    }
  }
  return anatomies
}

/* The theme side */

const cssFilesOf = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFilesOf(full)
    return entry.name.endsWith('.css') ? [full] : []
  })

// postcss rather than a line scan: it hands back selectors already separated from declaration
// values and comments, so a `content:` string or a commented-out rule cannot read as a live
// selector, and every position is the parser's own rather than a reconstructed line number.
const readTheme = () => {
  const classes = new Map()
  const attributes = new Map()

  for (const file of cssFilesOf(themeDir)) {
    postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule) => {
      const where = { file, line: rule.source.start.line }
      for (const match of rule.selector.matchAll(/\.(cnc-[a-z0-9_-]+)/g)) {
        if (!classes.has(match[1])) classes.set(match[1], where)
      }
      for (const match of rule.selector.matchAll(/\[(data-[a-z0-9-]+)/g)) {
        if (!attributes.has(match[1])) attributes.set(match[1], where)
      }
    })
  }

  return { classes, attributes }
}

/* Rules */

const anatomies = readAnatomies()
const theme = readTheme()

const declaredClasses = new Set(anatomies.flatMap((a) => a.parts.map((part) => part.value)))
const declaredStates = new Set(anatomies.flatMap((a) => a.states.map((state) => state.value)))

for (const [selector, where] of theme.classes) {
  if (declaredClasses.has(selector)) continue
  report(
    where.file,
    where.line,
    `.${selector} is styled but no anatomy declares it; the kit renders no such class`,
  )
}

for (const [attribute, where] of theme.attributes) {
  if (declaredStates.has(attribute)) continue
  report(where.file, where.line, `[${attribute}] is styled but no anatomy declares it as a state`)
}

for (const anatomy of anatomies) {
  // A states-only anatomy has no part to match, so the rule does not apply rather than always
  // failing.
  if (anatomy.parts.length === 0) continue
  if (anatomy.parts.some((part) => theme.classes.has(part.value))) continue
  report(
    anatomy.file,
    lineOf(anatomy.parts[0].node),
    `${anatomy.name} has no part the theme styles; canton-theme is missing this component`,
  )
}

/* Report */

const parts = anatomies.reduce((total, anatomy) => total + anatomy.parts.length, 0)
finish(
  `${anatomies.length} anatomies, ${parts} parts, ${theme.classes.size} theme selectors, in step`,
)
