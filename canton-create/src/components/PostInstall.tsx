import { Box, Text } from 'ink'
import Link from 'ink-link'
import type { ReactElement, ReactNode } from 'react'
import { Divider } from '#src/components/Divider'
import { type PackageManager, runScript } from '#src/packageManager'
import type { ProjectFacts } from '#src/projectDirectory'

const DOCS_URL = 'https://docs.dappbooster.cc/'
const COMPONENTS_URL = 'https://components.dappbooster.cc/'
const ISSUES_URL = 'https://github.com/BootNodeDev/canton-dappbooster/issues'

export interface PostInstallProps {
  directory: string
  starter: boolean
  localnet: boolean
  manager: PackageManager
  installed: boolean
  project: ProjectFacts
}

const Command = ({ children }: { children: string }): ReactElement => (
  <Text color="gray">{children}</Text>
)

const DockerStep = (): ReactElement => (
  <Text>
    - Docker must be running (or start it from the <Command>pnpm stack</Command> menu below).
  </Text>
)

const StackStep = (): ReactElement => (
  <Text>
    - Run <Command>pnpm stack</Command>, with Docker running choose "Stack up".
  </Text>
)

const ownNetworkSteps = (
  project: ProjectFacts,
  manager: PackageManager,
  starter: boolean,
): ReactNode[] => {
  const run = (script: string): string => runScript(manager, script)
  const dev = (
    <Text key="dev">
      - Start the app with <Command>{run('dev')}</Command> and open http://localhost:3012
    </Text>
  )
  const { dar } = project
  if (starter) {
    return [
      dev,
      <Text key="mock">- Pick "Mock Wallet" to connect with nothing installed.</Text>,
      ...(dar === undefined
        ? []
        : [
            <Text key="contract">
              - The sample contract in daml/ is optional. To put it on a ledger, point
              CANTON_JSON_API_URL and CANTON_BACKEND_TOKEN in .env at your participant, then run{' '}
              <Command>{run('build-dar')}</Command> and{' '}
              <Command>{`${run('deploy-dar')} -- ${dar}`}</Command>
            </Text>,
          ]),
    ]
  }
  return [
    <Text key="network">
      - Point .env at your network: CANTON_JSON_API_URL, CANTON_BACKEND_TOKEN and the VITE_ URLs
      {project.needsSpliceTag ? ', plus SPLICE_TAG for the contract build' : ''}.
    </Text>,
    ...(dar === undefined
      ? []
      : [
          <Text key="deploy">
            - Build and deploy the contract: <Command>{run('build-dar')}</Command>, then{' '}
            <Command>{`${run('deploy-dar')} -- ${dar}`}</Command>
          </Text>,
        ]),
    ...(project.hasBootstrap
      ? [
          <Text key="bootstrap">
            - Run <Command>{run('bootstrap')}</Command> once, to create what the app needs on the
            ledger.
          </Text>,
        ]
      : []),
    dev,
  ]
}

/** The closing screen: how to start the project, then where to read more. */
export const PostInstall = ({
  directory,
  starter,
  localnet,
  manager,
  installed,
  project,
}: PostInstallProps): ReactElement => (
  <Box flexDirection="column" rowGap={1} paddingBottom={1}>
    <Divider title="Post-install instructions" />
    <Text color="whiteBright">To start development on your project:</Text>
    <Box flexDirection="column">
      {localnet && <DockerStep />}
      <Text>
        - Move into the project's folder with <Command>{`cd ${directory}`}</Command>
      </Text>
      {!installed && (
        <Text>
          - Install the packages with <Command>{`${manager} install`}</Command>
        </Text>
      )}
      {localnet ? <StackStep /> : ownNetworkSteps(project, manager, starter)}
    </Box>
    {localnet && (
      <Text bold color="yellow">
        Warning: the first run pulls about 10 GB and can take a few minutes to start.
      </Text>
    )}
    <Text color="whiteBright">More info:</Text>
    <Box flexDirection="column">
      <Text>
        - The <Link url={DOCS_URL}>documentation</Link> has more detailed instructions about running
        the stack.
      </Text>
      <Text>
        - Components documentation is available <Link url={COMPONENTS_URL}>here</Link>.
      </Text>
      <Text>
        - Report issues with dAppBooster in the repo's <Link url={ISSUES_URL}>issue tracker</Link>.
      </Text>
    </Box>
  </Box>
)
