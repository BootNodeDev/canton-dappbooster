#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from 'node:util'
import { render } from 'ink'
import { App } from '#src/components/App'
import { detectPackageManager, isPackageManager } from '#src/packageManager'
import { isEmptyDir } from '#src/projectDirectory'
import { isTier, TIERS } from '#src/scaffold'

const TEMPLATES_DIR = path.resolve(import.meta.dirname, '..', 'templates')

const USAGE = `Usage: create-canton-dappbooster [directory] [options]

Options:
  --tier <app|localnet>   what to scaffold (picked from a list when omitted)
  --example <name|spec>   a complete example instead of a tier, e.g. vesting
  --pm <npm|pnpm|yarn|bun> package manager (detected from the one running this)
  --skip-install          write the files and stop
  --disable-git           skip creating a git repository
  -h, --help              this text
`

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'disable-git': { type: 'boolean' },
      example: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      pm: { type: 'string' },
      'skip-install': { type: 'boolean' },
      tier: { type: 'string' },
    },
  })
  if (values.help === true) {
    process.stdout.write(USAGE)
    return
  }

  const interactive = process.stdin.isTTY === true
  const directory = positionals[0]
  if (directory === undefined && !interactive) {
    fail(USAGE)
  }
  if (directory !== undefined && !isEmptyDir(path.resolve(directory))) {
    fail(`${directory} exists and is not empty.`)
  }
  const tier =
    values.tier === undefined
      ? undefined
      : isTier(values.tier)
        ? values.tier
        : fail(`Unknown tier: ${values.tier}. One of ${Object.keys(TIERS).join(', ')}.`)
  if (tier === undefined && values.example === undefined && !interactive) {
    fail('Pass --tier or --example when not running in a terminal.')
  }
  const manager =
    values.pm === undefined
      ? detectPackageManager()
      : isPackageManager(values.pm)
        ? values.pm
        : fail(`Unknown package manager: ${values.pm}`)

  const { waitUntilExit } = render(
    <App
      directory={directory}
      tier={values.example === undefined ? tier : undefined}
      example={values.example}
      templatesDir={TEMPLATES_DIR}
      manager={manager}
      install={values['skip-install'] !== true}
      git={values['disable-git'] !== true}
    />,
  )
  // The screen already shows what failed.
  await waitUntilExit().catch(() => {
    process.exitCode = 1
  })
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error))
})
