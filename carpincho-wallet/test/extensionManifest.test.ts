import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
const readText = (path: string): string => readFileSync(path, 'utf8')

describe('extension packaging', () => {
  it('defines a local Manifest V3 extension popup', () => {
    // Scenario: the browser extension is a Manifest V3 popup wallet injected on every origin
    // so it can reach local and deployed dApps. Broad <all_urls> injection is only safe because
    // account identity and signing are gated at runtime on an approved per-origin connection
    // (see extensionDirectProvider.test.ts); the manifest scope alone grants no account access.
    const manifest = readJson<{
      manifest_version?: number
      name?: string
      version?: string
      action?: { default_popup?: string; default_icon?: Record<string, string> }
      icons?: Record<string, string>
      permissions?: string[]
      host_permissions?: string[]
    }>('public/manifest.json')

    assert.equal(manifest.manifest_version, 3)
    assert.equal(manifest.name, 'Carpincho Wallet')
    assert.equal(manifest.action?.default_popup, 'index.html')
    assert.equal(manifest.action?.default_icon?.['32'], 'icons/carpincho-32.png')
    assert.equal(manifest.icons?.['128'], 'icons/carpincho-128.png')
    assert.ok(manifest.permissions?.includes('storage'))
    assert.ok(manifest.permissions?.includes('activeTab'))
    assert.ok(manifest.host_permissions?.includes('<all_urls>'))
  })

  it('sources the built manifest version from the monorepo root package.json', () => {
    const rootVersion = readJson<{ version: string }>('../package.json').version
    // Chrome rejects semver prerelease/build metadata; the build strips it.
    const expected = rootVersion.split(/[-+]/)[0]
    const built = readJson<{ version?: string }>('dist-extension/manifest.json')

    assert.equal(built.version, expected)
  })

  it('has a dedicated extension build that emits relative assets', () => {
    const pkg = readJson<{ scripts?: Record<string, string> }>('package.json')
    const viteConfig = readText('vite.config.ts')

    assert.equal(pkg.scripts?.['build:extension'], 'tsc -b --noEmit && vite build --mode extension')
    assert.match(viteConfig, /mode === 'extension'/)
    assert.match(viteConfig, /base: isExtension \? '\.\/' : '\/'/)
    assert.match(viteConfig, /outDir: isExtension \? 'dist-extension' : 'dist'/)
  })

  it('emits a classic content script without module imports', () => {
    const contentScript = readText('dist-extension/contentScript.js')

    assert.doesNotMatch(contentScript, /\bimport\s*[{*\w]/)
    assert.doesNotMatch(contentScript, /\bfrom\s*["'][^"']+["']/)
  })

  it('does not depend on remote stylesheet assets', () => {
    const html = readText('index.html')
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net/)
    assert.doesNotMatch(html, /https?:\/\//)
  })

  it('sizes the browser extension popup without affecting the web origin', () => {
    const main = readText('src/main.tsx')
    const css = readText('src/index.css')

    assert.match(main, /window\.location\.protocol === 'chrome-extension:'/)
    assert.match(main, /document\.documentElement\.dataset\.runtime = 'extension'/)
    assert.match(css, /html\[data-runtime="extension"\]/)
    assert.match(css, /width: 420px/)
    assert.match(css, /min-height: 600px/)
  })

  it('ships PNG toolbar icons for Chromium', () => {
    for (const size of [16, 32, 48, 128]) {
      const iconPath = `public/icons/carpincho-${size}.png`
      assert.equal(existsSync(iconPath), true)
      const bytes = readFileSync(iconPath)
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    }
  })
})
