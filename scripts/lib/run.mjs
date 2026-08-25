import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

const LABEL_COLOURS = [ANSI.cyan, ANSI.magenta, ANSI.yellow, ANSI.blue, ANSI.green]

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const log = (message) => {
  process.stdout.write(`${ANSI.bold}[dev]${ANSI.reset} ${message}\n`)
}

export const warn = (message) => {
  process.stderr.write(`${ANSI.bold}${ANSI.yellow}[dev]${ANSI.reset} ${message}\n`)
}

export const fail = (message, code = 1) => {
  process.stderr.write(`${ANSI.bold}${ANSI.red}[dev]${ANSI.reset} ${message}\n`)
  process.exit(code)
}

const writePrefixed = (stream, label, colour, chunk, carry) => {
  const text = carry.value + chunk.toString('utf8')
  const lines = text.split('\n')
  carry.value = lines.pop() ?? ''
  for (const line of lines) {
    stream.write(`${colour}${label}${ANSI.reset} ${ANSI.dim}|${ANSI.reset} ${line}\n`)
  }
}

const flushCarry = (stream, label, colour, carry) => {
  if (carry.value === '') {
    return
  }
  stream.write(`${colour}${label}${ANSI.reset} ${ANSI.dim}|${ANSI.reset} ${carry.value}\n`)
  carry.value = ''
}

export const runStep = (label, command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const colour = ANSI.cyan
    const cwd = options.cwd ?? repoRoot
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdoutCarry = { value: '' }
    const stderrCarry = { value: '' }
    process.stdout.write(
      `${colour}${label}${ANSI.reset} ${ANSI.dim}> ${command} ${args.join(' ')}${ANSI.reset}\n`,
    )
    child.stdout.on('data', (chunk) =>
      writePrefixed(process.stdout, label, colour, chunk, stdoutCarry),
    )
    child.stderr.on('data', (chunk) =>
      writePrefixed(process.stderr, label, colour, chunk, stderrCarry),
    )
    child.on('error', (error) => reject(error))
    child.on('exit', (code, signal) => {
      flushCarry(process.stdout, label, colour, stdoutCarry)
      flushCarry(process.stderr, label, colour, stderrCarry)
      if (code === 0) {
        resolve(undefined)
        return
      }
      reject(new Error(`${label} exited with ${signal ?? code}`))
    })
  })

export const captureStep = (label, command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const cwd = options.cwd ?? repoRoot
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => reject(error))
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }
      const message = stderr.trim() === '' ? stdout.trim() : stderr.trim()
      reject(new Error(`${label} exited with ${signal ?? code}: ${message}`))
    })
  })

export const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen({ port, host: '127.0.0.1', exclusive: true })
  })

export const requirePortsFree = async (ports) => {
  const results = await Promise.all(
    ports.map(async (entry) => ({ entry, free: await isPortFree(entry.port) })),
  )
  const busy = results.filter((r) => !r.free).map((r) => r.entry)
  if (busy.length === 0) {
    return
  }
  const detail = busy.map((entry) => `${entry.port} (${entry.label})`).join(', ')
  fail(
    `port(s) already in use: ${detail}. Stop the previous dev process or free the port and retry.`,
  )
}

const signalProcessGroup = (entry, sig) => {
  if (entry.child.exitCode !== null || entry.child.signalCode !== null) {
    return
  }
  const pid = entry.child.pid
  if (pid === undefined) {
    return
  }
  try {
    process.kill(-pid, sig)
    return
  } catch (error) {
    if (error.code === 'ESRCH') {
      return
    }
  }
  try {
    entry.child.kill(sig)
  } catch {
    // child is already gone
  }
}

export class DevSupervisor {
  constructor() {
    this.children = []
    this.shuttingDown = false
    this.exitCode = 0
    this.sigkillTimer = undefined
    this.onSignal = (signal) => this.shutdown(signal)
    this.onProcessExit = () => {
      for (const entry of this.children) {
        signalProcessGroup(entry, 'SIGKILL')
      }
    }
    process.on('SIGINT', this.onSignal)
    process.on('SIGTERM', this.onSignal)
    process.on('SIGHUP', this.onSignal)
    process.on('exit', this.onProcessExit)
  }

  spawn(label, command, args, options = {}) {
    const colour = LABEL_COLOURS[this.children.length % LABEL_COLOURS.length]
    const cwd = options.cwd ?? repoRoot
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    process.stdout.write(
      `${colour}${label}${ANSI.reset} ${ANSI.dim}started: ${command} ${args.join(' ')}${ANSI.reset}\n`,
    )
    const stdoutCarry = { value: '' }
    const stderrCarry = { value: '' }
    child.stdout.on('data', (chunk) =>
      writePrefixed(process.stdout, label, colour, chunk, stdoutCarry),
    )
    child.stderr.on('data', (chunk) =>
      writePrefixed(process.stderr, label, colour, chunk, stderrCarry),
    )
    const exited = new Promise((resolve) => {
      let settled = false
      const settle = () => {
        if (settled) {
          return
        }
        settled = true
        resolve(undefined)
      }
      child.on('error', (error) => {
        flushCarry(process.stdout, label, colour, stdoutCarry)
        flushCarry(process.stderr, label, colour, stderrCarry)
        process.stderr.write(
          `${colour}${label}${ANSI.reset} ${ANSI.dim}spawn error: ${error.message}${ANSI.reset}\n`,
        )
        if (!this.shuttingDown) {
          this.exitCode = this.exitCode === 0 ? 1 : this.exitCode
          this.shutdown('spawn-error')
        }
        settle()
      })
      child.on('exit', (code, signal) => {
        flushCarry(process.stdout, label, colour, stdoutCarry)
        flushCarry(process.stderr, label, colour, stderrCarry)
        const reason = signal === null ? `code ${code}` : `signal ${signal}`
        process.stdout.write(
          `${colour}${label}${ANSI.reset} ${ANSI.dim}exited (${reason})${ANSI.reset}\n`,
        )
        if (!this.shuttingDown) {
          if (code !== 0 && signal === null) {
            this.exitCode = code ?? 1
          }
          this.shutdown('child-exit')
        }
        settle()
      })
    })
    const entry = { label, child, colour, stdoutCarry, stderrCarry, exited }
    this.children.push(entry)
    return entry
  }

  async waitForExit() {
    await Promise.all(this.children.map((entry) => entry.exited))
    if (this.sigkillTimer !== undefined) {
      clearTimeout(this.sigkillTimer)
      this.sigkillTimer = undefined
    }
    process.removeListener('SIGINT', this.onSignal)
    process.removeListener('SIGTERM', this.onSignal)
    process.removeListener('SIGHUP', this.onSignal)
    process.removeListener('exit', this.onProcessExit)
    process.exit(this.exitCode)
  }

  shutdown(signal) {
    if (this.shuttingDown) {
      return
    }
    this.shuttingDown = true
    process.stdout.write(`${ANSI.bold}[dev]${ANSI.reset} shutting down (${signal})\n`)
    for (const entry of this.children) {
      signalProcessGroup(entry, 'SIGTERM')
    }
    this.sigkillTimer = setTimeout(() => {
      for (const entry of this.children) {
        signalProcessGroup(entry, 'SIGKILL')
      }
    }, 5000)
  }
}

export const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return {}
  }
  const result = {}
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) {
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = line.slice(0, eq).trim()
    const raw = line.slice(eq + 1).trim()
    const value =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw
    result[key] = value
  }
  return result
}
