import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chooseSdk,
  installedSdks,
  pinnedSdk,
  sdkVersionOf,
  withoutPackageContext,
} from './build-dar.mjs'

const LISTING = [
  { version: '3.4.11', installed: true },
  { version: '3.5.0-snapshot.20260801.0', installed: true },
  { version: '3.5.2', installed: true },
  { version: '3.5.11', installed: true, active: true },
  { version: '3.5.99', active: true },
]

describe('installed SDKs', () => {
  it('reads every installed stable version off `dpm version --output json`', () => {
    assert.deepEqual(installedSdks(LISTING), ['3.4.11', '3.5.2', '3.5.11'])
  })

  it('reads nothing off an empty listing', () => {
    assert.deepEqual(installedSdks([]), [])
  })
})

describe('SDK choice', () => {
  it('takes the pin when it is installed, even beside a newer patch', () => {
    assert.equal(chooseSdk(['3.5.2', '3.5.11'], '3.5.2'), '3.5.2')
  })

  it('takes the highest patch of the pin line rather than the highest string', () => {
    assert.equal(chooseSdk(['3.5.9', '3.5.11', '3.5.10'], '3.5.2'), '3.5.11')
  })

  it('never takes another minor or major line', () => {
    assert.equal(chooseSdk(['3.4.11', '3.6.0', '4.0.0'], '3.5.2'), undefined)
  })
})

describe('daml.yaml pin', () => {
  it('is the sdk-version the package declares', () => {
    assert.equal(pinnedSdk(), '3.5.2')
  })

  it('reads every form dpm accepts: plain, quoted, commented', () => {
    for (const line of [
      'sdk-version: 3.5.2',
      'sdk-version: "3.5.2"',
      "sdk-version: '3.5.2'",
      'sdk-version: 3.5.2 # tested',
    ]) {
      assert.equal(sdkVersionOf(`${line}\nname: x\n`), '3.5.2', line)
    }
  })

  it('reports nothing rather than guessing when the line is missing', () => {
    assert.equal(sdkVersionOf('name: x\nversion: 0.0.3\n'), undefined)
  })
})

describe('dpm environment', () => {
  it('drops every inherited package, project or SDK choice and keeps everything else', () => {
    const inherited = {
      DAML_PACKAGE: '/elsewhere',
      DAML_PROJECT: '/elsewhere',
      DPM_ASSEMBLY: '/elsewhere/assembly',
      DPM_LOCKFILE_ENABLED: 'true',
      DPM_MULTI_PACKAGE: '/elsewhere/multi-package.yaml',
      DPM_RESOLUTION_FILE: '/elsewhere/resolution.yaml',
      DPM_SDK_VERSION: '3.5.99',
      HOME: '/home/x',
      PATH: '/bin',
    }
    assert.deepEqual(withoutPackageContext(inherited), { HOME: '/home/x', PATH: '/bin' })
  })
})
