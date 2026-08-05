// The local Splice Scan, so the mock-first app runs from a fresh clone with no `.env`.
const DEFAULT_EXPLORER_URL = 'http://scan.localhost:4000'

export interface Env {
  VITE_EXPLORER_URL: string
}

// The value lands in an `href`, where `javascript:` would be a script sink.
const isHttpUrl = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * Validates the build's environment. Takes the source rather than reading `import.meta.env` so it
 * stays testable; `vite.config.ts` runs it once per build and defines the result back.
 */
export const parseEnv = (source: unknown): Env => {
  if (typeof source !== 'object' || source === null) {
    throw new Error('Invalid environment: expected the variables as an object')
  }

  // Absent is the zero-config case. A declared but blank value is a mistake, not a request for the
  // default, so it falls through to the check below.
  const explorerUrl = (source as Record<string, unknown>).VITE_EXPLORER_URL ?? DEFAULT_EXPLORER_URL

  if (typeof explorerUrl !== 'string' || !isHttpUrl(explorerUrl)) {
    throw new Error(
      `Invalid environment: VITE_EXPLORER_URL must be an http(s) url, e.g. ${DEFAULT_EXPLORER_URL}`,
    )
  }

  return { VITE_EXPLORER_URL: explorerUrl }
}
