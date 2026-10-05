#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import * as p from '@clack/prompts'
import { fetchExample, resolveExampleSpec } from '#src/example'
import {
  detectPackageManager,
  install,
  isPackageManager,
  type PackageManager,
  runScript,
} from '#src/packageManager'
import { missingPrerequisites } from '#src/prerequisites'
import { isTier, scaffold, scaffoldFromTemplate, TIERS, type Tier } from '#src/scaffold'

const TEMPLATES_DIR = path.resolve(import.meta.dirname, '..', 'templates')

const USAGE = `Usage: create-canton-dappbooster [directory] [options]

Options:
  --tier <app|localnet>   what to scaffold (prompted when omitted)
  --example <name|spec>   a complete example instead of a tier, e.g. vesting
  --pm <npm|pnpm|yarn|bun> package manager (detected from the one running this)
  --skip-install          write the files and stop
  -h, --help              this text
`

const fail = (message: string): never => {
  p.cancel(message)
  process.exit(1)
}

const bail = (): never => {
  p.cancel('Cancelled.')
  process.exit(0)
}

const unwrap = <T>(value: T): Exclude<T, symbol> =>
  p.isCancel(value) ? bail() : (value as Exclude<T, symbol>)

const isEmptyDir = (dir: string): boolean =>
  !fs.existsSync(dir) || fs.readdirSync(dir).filter((name) => name !== '.git').length === 0

const askDirectory = async (): Promise<string> =>
  unwrap(
    await p.text({
      message: 'Where should the project live?',
      placeholder: 'my-canton-dapp',
      validate: (value) => {
        if (value === undefined || value.trim() === '') {
          return 'A directory is required.'
        }
        if (!isEmptyDir(path.resolve(value))) {
          return `${value} exists and is not empty.`
        }
        return undefined
      },
    }),
  )

const askTier = async (): Promise<Tier> =>
  unwrap(
    await p.select({
      message: 'What do you want to start from?',
      options: Object.entries(TIERS).map(([value, hint]) => ({
        value: value as Tier,
        label: value,
        hint,
      })),
    }),
  )

const nextSteps = (
  dir: string,
  manager: PackageManager,
  tier: Tier | undefined,
  hasEnvExample: boolean,
): string => {
  const lines = [`cd ${dir}`, ...(hasEnvExample ? ['cp .env.example .env'] : [])]
  if (tier === 'localnet') {
    lines.push(
      'pnpm stack up',
      '',
      'Then pick "Wallet Gateway" in the app and log in with client secret "unsafe".',
    )
  } else if (tier === 'app') {
    lines.push(
      runScript(manager, 'dev'),
      '',
      'Pick "Mock Wallet" to connect with nothing installed.',
    )
  } else {
    lines.push('Then follow README.md.')
  }
  return lines.join('\n')
}

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
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
  p.intro('create-canton-dappbooster')

  const directory = positionals[0] ?? (interactive ? await askDirectory() : fail(USAGE))
  const targetDir = path.resolve(directory)
  const projectName = path.basename(targetDir)
  if (!isEmptyDir(targetDir)) {
    fail(`${directory} exists and is not empty.`)
  }

  const tier =
    values.example !== undefined
      ? undefined
      : values.tier !== undefined
        ? isTier(values.tier)
          ? values.tier
          : fail(`Unknown tier: ${values.tier}. One of ${Object.keys(TIERS).join(', ')}.`)
        : interactive
          ? await askTier()
          : fail('Pass --tier or --example when not running in a terminal.')

  const manager =
    values.pm === undefined
      ? detectPackageManager()
      : isPackageManager(values.pm)
        ? values.pm
        : fail(`Unknown package manager: ${values.pm}`)

  const spin = p.spinner()
  if (values.example === undefined) {
    spin.start(`Scaffolding the ${tier} tier`)
    scaffold({ projectName, targetDir, templatesDir: TEMPLATES_DIR, tier: tier as Tier })
    spin.stop(`Scaffolded the ${tier} tier into ${directory}`)
  } else {
    const spec = resolveExampleSpec(values.example)
    spin.start(`Fetching ${spec}`)
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canton-example-'))
    try {
      const templateDir = await fetchExample(spec, workDir)
      scaffoldFromTemplate({ projectName, targetDir, templateDir })
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true })
    }
    spin.stop(`Scaffolded ${spec} into ${directory}`)
  }

  if (tier === 'localnet') {
    for (const warning of await missingPrerequisites()) {
      p.log.warn(warning)
    }
    if (manager !== 'pnpm') {
      p.log.warn('The local stack scripts (scripts/dev-stack.sh) drive pnpm; install it too.')
    }
  }

  if (values['skip-install'] !== true) {
    p.log.step(`Installing with ${manager}`)
    await install(manager, targetDir)
  }

  p.note(
    nextSteps(directory, manager, tier, fs.existsSync(path.join(targetDir, '.env.example'))),
    'Next',
  )
  p.outro('Done.')
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error))
})
