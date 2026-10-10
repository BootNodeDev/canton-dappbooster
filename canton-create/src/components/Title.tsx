import { Box, Text } from 'ink'
import Gradient from 'ink-gradient'
import type { ReactElement } from 'react'

// "dAppBooster" in cfonts' chrome font, drawn once so the bundle ships no font files.
const BANNER = [
  ' ╔╦╗ ╔═╗ ╔═╗ ╔═╗ ╔╗  ╔═╗ ╔═╗ ╔═╗ ╔╦╗ ╔═╗ ╦═╗',
  '  ║║ ╠═╣ ╠═╝ ╠═╝ ╠╩╗ ║ ║ ║ ║ ╚═╗  ║  ║╣  ╠╦╝',
  ' ═╩╝ ╩ ╩ ╩   ╩   ╚═╝ ╚═╝ ╚═╝ ╚═╝  ╩  ╚═╝ ╩╚═',
].join('\n')

export const Title = (): ReactElement => (
  <Box alignItems="flex-end">
    <Gradient colors={['#ff438c', '#bb1d79', '#8b46a4', '#6a2581']}>
      <Text>{BANNER}</Text>
    </Gradient>
    <Box marginLeft={2}>
      <Text backgroundColor="#bb1d79" bold color="whiteBright">
        {' Canton '}
      </Text>
    </Box>
  </Box>
)
