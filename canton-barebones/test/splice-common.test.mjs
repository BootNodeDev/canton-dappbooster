import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const commonScript = path.join(projectRoot, 'scripts/splice-common.sh')

describe('Splice LocalNet shell config', () => {
  it('starts only the sv and app-user LocalNet profiles', () => {
    // Scenario: this stack activates only the app-user and SV UI profiles.
    // The official shared backend containers still expose app-provider ports.
    const output = execFileSync(
      'bash',
      ['-lc', `source "${commonScript}"; printf '%s\\n' "\${SPLICE_PROFILES[@]}"`],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    assert.deepEqual(output.trim().split('\n'), ['sv', 'app-user'])
  })

  it('exports the official compose variables required by LocalNet', () => {
    // Scenario: Docker Compose reads IMAGE_TAG and LocalNet paths from the
    // environment before resolving image names and bind mounts.
    const output = execFileSync(
      'bash',
      [
        '-lc',
        `source "${commonScript}"; printf '%s\\n' "$IMAGE_TAG" "$LOCALNET_DIR" "$LOCALNET_ENV_DIR"`,
      ],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    assert.deepEqual(output.trim().split('\n'), [
      '0.5.18',
      '/tmp/splice-localnet-test/splice-node/docker-compose/localnet',
      '/tmp/splice-localnet-test/splice-node/docker-compose/localnet/env',
    ])
  })

  it('uses the canton-barebones compose project and the local nginx override', () => {
    // Scenario: Splice and wallet-service share one compose project so Docker
    // groups all local stack containers under canton-barebones. The local
    // nginx override still disables app-provider UI routes when that profile is off.
    const output = execFileSync(
      'bash',
      ['-lc', `docker() { printf '%s\\n' "$@"; }; source "${commonScript}"; splice_compose config`],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          SPLICE_IMAGE_TAG: '0.5.18',
          SPLICE_BUNDLE_DIR: '/tmp/splice-localnet-test',
        },
        encoding: 'utf8',
      },
    )

    const args = output.trim().split('\n')

    assert.match(output, /--project-name\ncanton-barebones/)
    assert.ok(args.includes(path.join(projectRoot, 'config/splice/localnet-overrides.yaml')))
  })

  it('starts Splice without removing other services from the shared project', () => {
    // Scenario: Splice and wallet-service now share one compose project, so
    // Splice startup must not ask Compose to remove services missing from the
    // official Splice compose files.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.doesNotMatch(upScript, /--remove-orphans/)
    assert.match(upScript, /COMPOSE_IGNORE_ORPHANS=true splice_compose up -d/)
  })

  it('starts wallet-service without warning about Splice orphan services', () => {
    // Scenario: wallet-service uses a small local compose file while Splice
    // uses the official compose files. Both share one project, so the
    // wallet-service startup command must explicitly ignore expected orphans.
    const upScript = execFileSync('cat', [path.join(projectRoot, 'scripts/up.sh')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(
      upScript,
      /COMPOSE_IGNORE_ORPHANS=true docker compose --project-directory "\$ROOT" up -d --build wallet-service/,
    )
  })

  it('passes Docker-reachable Splice URLs into wallet-service', () => {
    // Scenario: wallet-service runs inside its own container, so URLs that are
    // valid in a browser, such as localhost, would point back to wallet-service.
    // The compose config must inject host.docker.internal URLs so SDK helpers
    // can reach the LocalNet nginx routes from inside Docker.
    const composeFile = execFileSync('cat', [path.join(projectRoot, 'docker-compose.yaml')], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    assert.match(
      composeFile,
      /SPLICE_VALIDATOR_URL: "\$\{SPLICE_VALIDATOR_URL:-http:\/\/host\.docker\.internal:2000\/api\/validator\}"/,
    )
    assert.match(
      composeFile,
      /SPLICE_SCAN_API_URL: "\$\{SPLICE_SCAN_API_URL:-http:\/\/host\.docker\.internal:4000\/api\/scan\}"/,
    )
    assert.match(
      composeFile,
      /SPLICE_REGISTRY_API_URL: "\$\{SPLICE_REGISTRY_API_URL:-http:\/\/host\.docker\.internal:2000\/api\/validator\/v0\/scan-proxy\}"/,
    )
  })
})
