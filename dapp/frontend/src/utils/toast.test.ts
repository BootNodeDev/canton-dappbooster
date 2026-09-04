import { afterEach, describe, expect, it } from 'vitest'
import { toast, toaster } from '@/utils/toast'

describe('toast lifetime', () => {
  afterEach(() => {
    toaster.remove()
  })

  it('lets a plain toast time out on the shared duration', () => {
    toast.success('Claimed 250 AMT')
    expect(toaster.getVisibleToasts()[0].duration).toBe(3200)
  })

  it('keeps an error until it is dismissed, since it has to be read in full and often copied', () => {
    toast.error('Wallet refused the submission')
    expect(toaster.getVisibleToasts()[0].duration).toBe(Number.POSITIVE_INFINITY)
  })

  it('keeps a toast carrying an action, whose link has to be there when it is reached for', () => {
    toast.success('Grant created', { action: { label: 'View pending grants', to: '/pending' } })
    expect(toaster.getVisibleToasts()[0].duration).toBe(Number.POSITIVE_INFINITY)
  })
})
