#!/usr/bin/env node
import path from 'node:path'
import { parseArgs } from 'node:util'
import { render } from 'ink'
import { EXAMPLES, STARTER } from '#src/apps'
import { App } from '#src/components/App'
import { detectPackageManager } from '#src/packageManager'
import { isEmptyDir } from '#src/projectDirectory'

const SCAFFOLD_DIR = path.resolve(import.meta.dirname, '..', 'scaffold')

const USAGE = `Usage: create-canton-dappbooster [directory] [options]

Options:
  --example <name>   start from an example dApp instead of the starter: ${Object.keys(EXAMPLES).join(', ')}
  --localnet         add a Canton network that runs on this computer, in Docker
  --skip-install     write the files and stop
  --disable-git      skip creating a git repository
  -h, --help         this text

In a terminal, whatever the options leave out is asked. Without one, the directory is
required and the rest take their defaults: the starter, no local network.
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
      localnet: { type: 'boolean' },
      'skip-install': { type: 'boolean' },
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

  const { waitUntilExit } = render(
    <App
      directory={directory}
      app={values.example ?? (interactive ? undefined : STARTER)}
      localnet={values.localnet ?? (interactive ? undefined : false)}
      scaffoldDir={SCAFFOLD_DIR}
      manager={detectPackageManager()}
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
