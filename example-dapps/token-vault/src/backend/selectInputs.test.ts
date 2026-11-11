import type { Holding } from '@bootnodedev/canton-dappbooster'
import { describe, expect, it } from 'vitest'
import { selectInputs } from '@/backend/selectInputs'

const USDX = { admin: 'token-issuer::ns', id: 'USDX' }
const VSH = { admin: 'vault-operator::ns', id: 'VSH' }

const holding = (cid: string, amount: string, extra: Partial<Holding> = {}): Holding => ({
  amount,
  contractId: cid,
  instrumentId: USDX,
  isLocked: false,
  ...extra,
})

const pick = (amount: string, holdings: Holding[]) =>
  selectInputs({ amount, holdings, instrumentId: USDX })

describe('selectInputs', () => {
  it('takes the largest holding first and stops once the amount is covered', () => {
    expect(
      pick('25.0', [holding('00a', '10.0'), holding('00b', '40.0'), holding('00c', '5.0')]),
    ).toEqual(['00b'])
  })

  it('adds holdings until they cover the amount', () => {
    expect(
      pick('25.0', [holding('00a', '10.0'), holding('00b', '20.0'), holding('00c', '5.0')]),
    ).toEqual(['00b', '00a'])
  })

  it('never spends a locked holding, which is escrowed against another settlement', () => {
    expect(
      pick('25.0', [holding('00a', '100.0', { isLocked: true }), holding('00b', '25.0')]),
    ).toEqual(['00b'])
  })

  it('ignores another instrument, even one holding plenty', () => {
    expect(
      pick('25.0', [holding('00a', '100.0', { instrumentId: VSH }), holding('00b', '30.0')]),
    ).toEqual(['00b'])
  })

  it('reports undefined when the spendable holdings fall short', () => {
    expect(pick('25.0', [holding('00a', '10.0'), holding('00b', '14.9999999999')])).toBeUndefined()
  })

  it('covers an amount its holdings meet exactly, to the last of ten places', () => {
    expect(
      pick('0.0000000003', [holding('00a', '0.0000000001'), holding('00b', '0.0000000002')]),
    ).toEqual(['00b', '00a'])
  })

  it('reports undefined for an amount no holding could cover', () => {
    expect(pick('0.0', [holding('00a', '10.0')])).toBeUndefined()
    expect(pick('lots', [holding('00a', '10.0')])).toBeUndefined()
  })

  it('picks the same holding whatever order two equal ones arrive in', () => {
    const holdings = [holding('00b', '25.0'), holding('00a', '25.0')]

    expect(pick('25.0', holdings)).toEqual(['00a'])
    expect(pick('25.0', [...holdings].reverse())).toEqual(['00a'])
  })
})
