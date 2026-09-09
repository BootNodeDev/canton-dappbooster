export const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

export const valueAt = (value: unknown, ...path: readonly string[]): unknown =>
  path.reduce<unknown>((at, key) => asRecord(at)?.[key], value)
