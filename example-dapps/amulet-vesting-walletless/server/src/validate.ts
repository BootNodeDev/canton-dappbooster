// Request bodies arrive as unknown JSON. Each reader here either returns the typed value or throws a
// BadRequest naming the field, which the app turns into a 400 the UI can show as it stands.

import { isAmount } from '#server/domain/amount'

export class BadRequest extends Error {}

type Body = Record<string, unknown>

export const asBody = (value: unknown): Body => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequest('expected a JSON object')
  }
  return value as Body
}

export const text = (body: Body, key: string, max = 1000): string => {
  const value = body[key]
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new BadRequest(`${key} must be a non-empty string of at most ${max} characters`)
  }
  return value
}

export const optionalText = (body: Body, key: string, max = 1000): string | undefined =>
  body[key] === undefined || body[key] === null || body[key] === ''
    ? undefined
    : text(body, key, max)

export const amount = (body: Body, key: string): string => {
  const value = text(body, key, 64)
  if (!isAmount(value)) {
    throw new BadRequest(`${key} must be a decimal amount with at most 10 places`)
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
