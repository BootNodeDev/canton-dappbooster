import { Select } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { type ReactElement, useState } from 'react'
import { Divider } from '#src/components/Divider'
import { isTier, TIERS, type Tier } from '#src/scaffold'

const OPTIONS = Object.entries(TIERS).map(([value, hint]) => ({
  label: `${value}: ${hint}`,
  value,
}))

/** The arrow-key list of tiers, shown when `--tier` is not given. */
export const TierSelect = ({ onSelect }: { onSelect: (tier: Tier) => void }): ReactElement => {
  const [tier, setTier] = useState<Tier>()

  const select = (value: string): void => {
    if (isTier(value)) {
      setTier(value)
      onSelect(value)
    }
  }

  return (
    <Box flexDirection="column" rowGap={1}>
      <Divider title="Select tier" />
      {tier === undefined ? (
        <Box flexDirection="column">
          <Text color="whiteBright">What do you want to create?</Text>
          <Select options={OPTIONS} onChange={select} />
        </Box>
      ) : (
        <Text>
          Tier:{' '}
          <Text bold color="green">
            {tier}
          </Text>
        </Text>
      )}
    </Box>
  )
}
