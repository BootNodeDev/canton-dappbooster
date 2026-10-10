#!/usr/bin/env bun
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'

const COLS = 92
const ROWS = 26
const IDLE_CAP_SECONDS = 2
const TIME_LIMIT_SECONDS = 15
const FRAME_MERGE_SECONDS = 0.15
const PROJECT = 'my-dapp'
const ENTER = '\r'
const DOWN = '\u001B[B'

const PKG = path.resolve(import.meta.dir, '..')
const OUT = path.join(PKG, 'demo.svg')

const PNPM = Bun.which('pnpm')
if (PNPM === null) {
  throw new Error('pnpm not found on PATH')
}

type CastEvent = [seconds: number, kind: 'o', data: string]

const work = mkdtempSync(path.join(tmpdir(), 'canton-create-demo-'))
const stage = path.join(work, 'stage')
const shimDir = path.join(work, 'shim')
mkdirSync(stage)
mkdirSync(shimDir)

// The tarball, not this folder: scaffold/ here holds node_modules and builds that `files` leaves out.
const pack = Bun.spawnSync([PNPM, 'pack', '--pack-destination', work], {
  cwd: PKG,
  stderr: 'inherit',
})
const tarball = pack.stdout.toString().trim().split('\n').at(-1)
if (pack.exitCode !== 0 || tarball === undefined) {
  throw new Error('pnpm pack failed')
}
Bun.spawnSync(['tar', '-xzf', tarball, '-C', work])
const CLI = path.join(work, 'package', 'dist', 'index.js')

// The recorded command line is the one a user types, while the code it runs is this working tree.
const pnpmVersion = Bun.spawnSync([PNPM, '--version']).stdout.toString().trim()
const shim = path.join(shimDir, 'pnpm')
writeFileSync(
  shim,
  `#!/bin/sh
if [ "$1" = "create" ] && [ "$2" = "canton-dappbooster" ]; then
  shift 2
  export npm_config_user_agent="pnpm/${pnpmVersion} node/${process.version}"
  exec node "${CLI}" "$@"
fi
exec "${PNPM}" "$@"
`,
)
chmodSync(shim, 0o755)

const decoder = new TextDecoder()
const started = performance.now()
const events: CastEvent[] = []
let seen = ''

const proc = Bun.spawn(['bash', '--norc', '--noprofile', '-i'], {
  cwd: stage,
  env: {
    ...process.env,
    PS1: '$ ',
    PATH: `${shimDir}:${process.env.PATH}`,
    TERM: 'xterm-256color',
  },
  terminal: {
    cols: COLS,
    rows: ROWS,
    data(_terminal, chunk) {
      const text = decoder.decode(chunk, { stream: true })
      events.push([(performance.now() - started) / 1000, 'o', text])
      seen += text
    },
  },
})
const terminal = proc.terminal
if (terminal === undefined) {
  throw new Error('Bun did not open a terminal for the shell')
}

const pause = (seconds: number): Promise<void> => Bun.sleep(seconds * 1000)

const expect = async (text: string, timeoutSeconds: number): Promise<void> => {
  const deadline = performance.now() + timeoutSeconds * 1000
  while (performance.now() < deadline) {
    if (stripVTControlCharacters(seen).includes(text)) {
      return
    }
    await pause(0.1)
  }
  throw new Error(`timed out waiting for "${text}"\n--- tail ---\n${seen.slice(-1500)}`)
}

const typeOut = async (text: string): Promise<void> => {
  for (const char of text) {
    terminal.write(char)
    await pause(0.085)
  }
}

try {
  await expect('$ ', 15)
  await pause(0.7)
  await typeOut('pnpm create canton-dappbooster')
  await pause(0.5)
  terminal.write(ENTER)

  await expect('Project name', 30)
  await pause(1)
  await typeOut(PROJECT)
  await pause(0.6)
  terminal.write(ENTER)

  await expect('Choose whether to install a Canton local network', 15)
  await pause(1.3)
  terminal.write(DOWN)
  await pause(0.8)
  terminal.write(ENTER)

  await expect('Choose the dApp your project starts from', 15)
  await pause(1.3)
  terminal.write(ENTER)

  // Past the time limit on purpose, so the trim lands on a whole frame.
  await expect('Installing packages', 60)
  await pause(6)
} finally {
  terminal.close()
  proc.kill()
  await proc.exited
}

let shift = 0
let previous = 0
const frames: CastEvent[] = []
for (const [stamp, kind, data] of events) {
  const gap = stamp - previous
  if (gap > IDLE_CAP_SECONDS) {
    shift += gap - IDLE_CAP_SECONDS
  }
  previous = stamp
  const capped = Number((stamp - shift).toFixed(6))
  if (capped > TIME_LIMIT_SECONDS) {
    break
  }
  const last = frames.at(-1)
  // Merging only changes when bytes are flushed, never which bytes, so the screen stays exact.
  if (last !== undefined && capped - last[0] < FRAME_MERGE_SECONDS) {
    last[2] += data
  } else {
    frames.push([capped, kind, data])
  }
}

const cast = path.join(work, 'demo.cast')
const header = {
  version: 2,
  width: COLS,
  height: ROWS,
  timestamp: Math.floor(Date.now() / 1000),
  env: { SHELL: '/bin/zsh', TERM: 'xterm-256color' },
}
writeFileSync(cast, [header, ...frames].map((line) => JSON.stringify(line)).join('\n'))

const convert = Bun.spawnSync(
  [
    PNPM,
    'dlx',
    'svg-term-cli',
    '--in',
    cast,
    '--out',
    OUT,
    '--window',
    '--width',
    String(COLS),
    '--height',
    String(ROWS),
    '--padding',
    '10',
  ],
  { stdout: 'inherit', stderr: 'inherit' },
)
rmSync(work, { recursive: true, force: true })
if (convert.exitCode !== 0) {
  throw new Error(`svg-term-cli exited with ${convert.exitCode}`)
}

const lastFrame = frames.at(-1)?.[0] ?? 0
console.log(
  `wrote ${OUT}: ${frames.length} frames, ${lastFrame.toFixed(1)}s, ${Math.floor(statSync(OUT).size / 1024)} KB`,
)
