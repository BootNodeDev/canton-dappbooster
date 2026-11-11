import { afterEach, describe, expect, it } from 'vitest'
import { toast, toaster } from '@/utils/toast'

describe('toast lifetime', () => {
  afterEach(() => {
    toaster.remove()
  })

  it('lets a plain toast time out on the shared duration', () => {
    toast.success('Funded the 250 USDX deposit')
    expect(toaster.getVisibleToasts()[0].duration).toBe(3200)
  })

  it('keeps an error until it is dismissed, since it has to be read in full and often copied', () => {
    toast.error('Wallet refused the submission')
    expect(toaster.getVisibleToasts()[0].duration).toBe(Number.POSITIVE_INFINITY)
  })
})
