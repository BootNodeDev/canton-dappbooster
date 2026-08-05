import { z } from 'zod'

// The local Splice Scan, so the mock-first app runs from a fresh clone with no `.env`. A declared
// but blank value is a mistake, not a request for the default, and still fails.
const DEFAULT_EXPLORER_URL = 'http://scan.localhost:4000'

const schema = z.object({
  // Protocol-restricted: the value lands in an `href`, where `javascript:` would be a script sink.
  VITE_EXPLORER_URL: z
    .url({
      protocol: /^https?$/,
      error: `must be an http(s) url, e.g. ${DEFAULT_EXPLORER_URL}`,
    })
    .default(DEFAULT_EXPLORER_URL),
})

export type Env = z.infer<typeof schema>

/**
 * Validates the build's environment. Takes the source rather than reading `import.meta.env` so it
 * stays testable; the app parses once in `config.ts`.
 */
export const parseEnv = (source: unknown): Env => {
  const result = schema.safeParse(source)
  if (result.success) return result.data

  const detail = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid environment: ${detail}`)
}
