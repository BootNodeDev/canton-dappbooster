import { compareAmounts, isAmount } from '#server/domain/amount'
import type { VestingSchedule } from '#server/domain/types'

export class BadRequest extends Error {}

type Body = Record<string, unknown>

export const asBody = (value: unknown): Body => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequest('expected a JSON object')
  }
  return value as Body
}

export const text = (body: Body, key: string, max: number): string => {
  const value = body[key]
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new BadRequest(`${key} must be a non-empty string of at most ${max} characters`)
  }
  return value
}

export const optionalText = (body: Body, key: string, max: number): string | undefined =>
  body[key] === undefined || body[key] === null || body[key] === ''
    ? undefined
    : text(body, key, max)

export const amount = (body: Body, key: string): string => {
  const value = text(body, key, 64)
  if (!isAmount(value) || compareAmounts(value, '0') <= 0) {
    throw new BadRequest(`${key} must be a positive decimal amount with at most 10 places`)
  }
  return value
}

export const party = (body: Body, key: string): string => {
  const value = text(body, key, 512)
  if (!value.includes('::')) {
    throw new BadRequest(`${key} must be a party id (hint::fingerprint)`)
  }
  return value
}

type Loose = { [key: string]: unknown } | undefined

// Shape only: the Daml model checks what the curve means, and refuses one that makes none.
export const schedule = (body: Body, key: string): VestingSchedule => {
  const value = body[key] as Loose
  const curve = value?.curve as Loose
  const points = curve?.points
  const linear =
    curve?.kind === 'linear' && typeof curve.start === 'string' && typeof curve.end === 'string'
  const milestone =
    curve?.kind === 'milestone' &&
    Array.isArray(points) &&
    points.every(
      (point: Loose) => typeof point?.time === 'string' && typeof point.fraction === 'number',
    )
  if (typeof value?.cliff !== 'string' || !(linear || milestone)) {
    throw new BadRequest(`${key} must be a linear or milestone schedule with a cliff`)
  }
  return value as unknown as VestingSchedule
}
