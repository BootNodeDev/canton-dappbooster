import { Box, Text } from 'ink'
import Link from 'ink-link'
import type { ReactElement, ReactNode } from 'react'
import { Divider } from '#src/components/Divider'
import { type PackageManager, runScript } from '#src/packageManager'
import type { Tier } from '#src/scaffold'

const DOCS_URL = 'https://docs.dappbooster.cc/'
const ISSUES_URL = 'https://github.com/BootNodeDev/canton-dappbooster/issues'

export interface PostInstallProps {
  directory: string
  tier: Tier | undefined
  manager: PackageManager
  installed: boolean
}

const Command = ({ children }: { children: string }): ReactElement => (
  <Text color="gray">{children}</Text>
)

const startSteps = (tier: Tier | undefined, manager: PackageManager): ReactNode[] => {
  if (tier === 'app') {
    return [
      <Text key="dev">
        - Start the app with <Command>{runScript(manager, 'dev')}</Command> and open
        http://localhost:3012
      </Text>,
      <Text key="wallet">- Pick "Mock Wallet" to connect with nothing installed.</Text>,
    ]
  }
  if (tier === 'localnet') {
    return [
      <Text key="needs">- Docker must be running, and the DAML SDK (dpm) installed.</Text>,
      <Text key="up">
        - Start everything with <Command>pnpm stack up</Command>
      </Text>,
      <Text key="wallet">
        - In the app, pick "Wallet Gateway" and log in with the client secret "unsafe".
      </Text>,
    ]
  }
  return [<Text key="readme">- Follow the project's README.md.</Text>]
}

/** The closing screen: how to start the project, then where to read more. */
export const PostInstall = ({
  directory,
  tier,
  manager,
  installed,
}: PostInstallProps): ReactElement => (
  <Box flexDirection="column" rowGap={1} paddingBottom={1}>
    <Divider title="Post-install instructions" />
    <Text color="whiteBright">To start development on your project:</Text>
    <Box flexDirection="column">
      <Text>
        - Move into the project's folder with <Command>{`cd ${directory}`}</Command>
      </Text>
      {!installed && (
        <Text>
          - Install the packages with <Command>{`${manager} install`}</Command>
        </Text>
      )}
      {startSteps(tier, manager)}
    </Box>
    {tier === 'localnet' && (
      <Text bold color="yellow">
        The first run downloads several GB of Docker images and takes a few minutes.
      </Text>
    )}
    <Text color="whiteBright">More info:</Text>
    <Box flexDirection="column">
      <Text>- The project's README.md explains how it is put together.</Text>
      <Text>
        - Components documentation is at <Link url={DOCS_URL}>docs.dappbooster.cc</Link>.
      </Text>
      <Text>
        - Report issues in the <Link url={ISSUES_URL}>issue tracker</Link>.
      </Text>
    </Box>
  </Box>
)
