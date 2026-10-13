import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPrerelease, parseVersion, rewriteManifests } from './release-version.mjs'

// The workspace in miniature: a private root, two published libraries, one private consumer that
// depends on both, and a private package that depends on neither.
const manifests = {
  'package.json': { name: 'cn-dappbooster', private: true, version: '0.3.0' },
  'canton-connect/package.json': { name: '@bootnodedev/canton-connect', version: '0.3.0' },
  'canton-dappbooster/package.json': {
    name: '@bootnodedev/canton-dappbooster',
    version: '0.3.0',
    devDependencies: { '@bootnodedev/canton-connect': '^0.3.0', tsdown: '^0.22.14' },
    peerDependencies: { '@bootnodedev/canton-connect': '^0.3.0', react: '^19.0.0' },
  },
  'dapp/daml/package.json': { name: '@canton-dappbooster/daml', private: true, version: '0.3.0' },
  'dapp/frontend/package.json': {
    name: '@canton-dappbooster/frontend',
    private: true,
    version: '0.3.0',
    dependencies: {
      '@bootnodedev/canton-connect': '^0.3.0',
      '@bootnodedev/canton-dappbooster': '^0.3.0',
      react: '^19.1.0',
    },
  },
}

describe('release version rewriting', () => {
  it('writes the version into the root and every published library', () => {
    const next = rewriteManifests(manifests, '0.4.0')

    assert.equal(next['package.json'].version, '0.4.0')
    assert.equal(next['canton-connect/package.json'].version, '0.4.0')
    assert.equal(next['canton-dappbooster/package.json'].version, '0.4.0')
    // Private, so it keeps its own version: the DAR is named by dapp/daml/daml.yaml.
    assert.equal(next['dapp/daml/package.json'].version, '0.3.0')
    assert.equal(next['dapp/frontend/package.json'].version, '0.3.0')
  })

  it('rewrites every range pointing at a library, and nothing else', () => {
    const next = rewriteManifests(manifests, '0.4.0')
    const kit = next['canton-dappbooster/package.json']
    const app = next['dapp/frontend/package.json']

    assert.equal(kit.devDependencies['@bootnodedev/canton-connect'], '^0.4.0')
    assert.equal(kit.peerDependencies['@bootnodedev/canton-connect'], '^0.4.0')
    assert.equal(app.dependencies['@bootnodedev/canton-connect'], '^0.4.0')
    assert.equal(app.dependencies['@bootnodedev/canton-dappbooster'], '^0.4.0')
    assert.equal(kit.devDependencies.tsdown, '^0.22.14')
    assert.equal(kit.peerDependencies.react, '^19.0.0')
    assert.equal(app.dependencies.react, '^19.1.0')
  })

  it('leaves the input untouched', () => {
    rewriteManifests(manifests, '0.4.0')

    assert.equal(manifests['canton-connect/package.json'].version, '0.3.0')
    assert.equal(
      manifests['dapp/frontend/package.json'].dependencies['@bootnodedev/canton-connect'],
      '^0.3.0',
    )
  })

  it('keeps a prerelease linked by putting the same string in both halves', () => {
    // ^0.4.0-rc.0 satisfies 0.4.0-rc.0, so the local folders still win over npm.
    const next = rewriteManifests(manifests, '0.4.0-rc.0')

    assert.equal(next['canton-connect/package.json'].version, '0.4.0-rc.0')
    assert.equal(
      next['dapp/frontend/package.json'].dependencies['@bootnodedev/canton-connect'],
      '^0.4.0-rc.0',
    )
    assert.equal(isPrerelease('0.4.0-rc.0'), true)
    assert.equal(isPrerelease('0.4.0'), false)
  })

  it('refuses anything that is not a bare version', () => {
    assert.equal(parseVersion('0.4.0'), '0.4.0')
    assert.equal(parseVersion('0.4.0-rc.0'), '0.4.0-rc.0')
    for (const argument of [undefined, '', 'v0.4.0', '^0.4.0', '0.4', '--', '0.4.0 ', 'latest']) {
      assert.throws(() => parseVersion(argument), /not a version/)
    }
  })
})
