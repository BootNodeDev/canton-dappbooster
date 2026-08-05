import { z } from 'zod'

const schema = z.object({
  VITE_EXPLORER_URL: z.url('must be a url, e.g. http://scan.localhost:4000'),
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
