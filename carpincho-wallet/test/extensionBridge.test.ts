import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  CARPINCHO_PROVIDER_ID,
  CARPINCHO_PROVIDER_NAME,
  extensionAck,
  isForCarpincho,
  isSpliceWalletRequest,
  WalletEvent,
} from '@/extension/messages'

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
const readText = (path: string): string => readFileSync(path, 'utf8')

describe('extension postMessage bridge', () => {
  it('declares content script and background worker entrypoints', () => {
    // Scenario: the extension must inject its provider bridge on every dApp page, while the
    // background worker owns popup request coordination. The manifest should therefore expose the
    // content script bundle at document start for all URLs and the module background worker.
    const manifest = readJson<{
      background?: { service_worker?: string; type?: string }
      content_scripts?: Array<{ matches?: string[]; js?: string[]; run_at?: string }>
    }>('public/manifest.json')
    const viteConfig = readText('vite.config.ts')

    assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' })
    assert.deepEqual(manifest.content_scripts?.[0]?.js, ['contentScript.js'])
    assert.equal(manifest.content_scripts?.[0]?.run_at, 'document_start')
    assert.ok(manifest.content_scripts?.[0]?.matches?.includes('<all_urls>'))
    assert.match(
      viteConfig,
      /contentScript: resolve\(__dirname, 'src\/extension\/contentScript\.ts'\)/,
    )
    assert.match(viteConfig, /background: resolve\(__dirname, 'src\/extension\/background\.ts'\)/)
  })

  it('uses the Canton dapp-sdk postMessage protocol and Carpincho target', () => {
    assert.equal(CARPINCHO_PROVIDER_ID, 'carpincho-wallet')
    assert.equal(CARPINCHO_PROVIDER_NAME, 'Carpincho Wallet')
    assert.deepEqual(extensionAck(), {
      type: WalletEvent.SPLICE_WALLET_EXT_ACK,
      target: 'carpincho-wallet',
    })
    assert.equal(isForCarpincho({ target: undefined }), true)
    assert.equal(isForCarpincho({ target: 'carpincho-wallet' }), true)
    assert.equal(isForCarpincho({ target: 'other-wallet' }), false)
    assert.equal(
      isSpliceWalletRequest({
        type: WalletEvent.SPLICE_WALLET_REQUEST,
        request: { jsonrpc: '2.0', id: '1', method: 'status' },
      }),
      true,
    )
  })

  it('uses the extension action popup instead of opening tabs or windows', () => {
    const background = readText('src/extension/background.ts')

    assert.match(background, /openPopup/)
    assert.match(background, /setBadgeText/)
    assert.doesNotMatch(background, /windows\.create/)
    assert.doesNotMatch(background, /tabs\.create/)
  })
})
