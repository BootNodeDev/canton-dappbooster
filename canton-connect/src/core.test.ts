/// <reference types="vite/client" />
import { expect, it } from 'vitest'

const SOURCES: Record<string, string> = import.meta.glob(['./**/*.ts', './**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

// A type-only import is erased at build, so only a value import reaches a consumer's runtime.
const VALUE_SPECIFIER =
  /^(?:import|export)\s+(?!type\b)[^'"]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm

const sourceOf = (specifier: string): string => {
  const base = `./${specifier.slice('#src/'.length)}`
  const file = ['.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((ext) => `${base}${ext}`)
    .find((candidate) => SOURCES[candidate] !== undefined)
  if (file === undefined) {
    throw new Error(`cannot resolve ${specifier}`)
  }
  return SOURCES[file] ?? ''
}

const runtimeImportsOf = (entry: string, seen = new Set<string>()): string[] => {
  if (seen.has(entry)) {
    return []
  }
  seen.add(entry)
  const specifiers = [...sourceOf(entry).matchAll(VALUE_SPECIFIER)].map(
    (match) => match[1] ?? match[2] ?? '',
  )
  return specifiers.flatMap((specifier) =>
    specifier.startsWith('#src/') ? runtimeImportsOf(specifier, seen) : [specifier],
  )
}

it('the core entry imports nothing outside the package at runtime, so no React and no SDK', () => {
  expect(runtimeImportsOf('#src/core')).toEqual([])
})

it('the main entry does reach React, which is what keeps the walk honest', () => {
  expect(runtimeImportsOf('#src/index')).toContain('react')
})
