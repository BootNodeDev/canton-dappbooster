import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { downloadJson } from '@/utils/download'

const setSecureContext = (value: boolean): void => {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

describe('downloadJson', () => {
  afterEach(() => {
    setSecureContext(true)
  })

  it('throws outside a secure context', () => {
    setSecureContext(false)
    assert.throws(() => downloadJson('x.json', { a: 1 }), /secure context/i)
  })

  it('downloads pretty-printed JSON via an anchor and revokes the url', async () => {
    setSecureContext(true)
    const revoked: string[] = []
    const clicks: Array<{ download: string; href: string }> = []
    let captured: Blob | null = null
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = (blob: Blob): string => {
      captured = blob
      return 'blob:fake'
    }
    URL.revokeObjectURL = (u: string) => {
      revoked.push(u)
    }
    const originalAnchorClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement): void {
      clicks.push({ download: this.download, href: this.href })
    }
    const data = { v: 1, accounts: [] }
    try {
      downloadJson('vault.json', data)
      assert.equal(clicks.length, 1)
      assert.equal(clicks[0]?.download, 'vault.json')
      assert.equal(clicks[0]?.href, 'blob:fake')
      assert.deepEqual(revoked, ['blob:fake'])
      assert.ok(captured)
      assert.equal((captured as Blob).type, 'application/json')
      assert.equal(await (captured as Blob).text(), JSON.stringify(data, null, 2))
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
      HTMLAnchorElement.prototype.click = originalAnchorClick
    }
  })
})
