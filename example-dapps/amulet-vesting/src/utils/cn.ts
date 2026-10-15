// Minimal className joiner (truthy strings only). Avoids a clsx dependency.
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')
