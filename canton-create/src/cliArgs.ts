import { parseArgs } from 'node:util'

/** The flags and the directory. pnpm forwards a `--`, so it is dropped and a flag after it counts. */
export const parseCliArgs = (args: string[]) => {
  const { values, positionals } = parseArgs({
    args: args.filter((arg) => arg !== '--'),
    allowPositionals: true,
    options: {
      'disable-git': { type: 'boolean' },
      example: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      localnet: { type: 'boolean' },
      'skip-install': { type: 'boolean' },
    },
  })
  if (positionals.length > 1) {
    throw new Error(`Expected one directory, got: ${positionals.join(' ')}`)
  }
  return { values, directory: positionals[0] }
}
