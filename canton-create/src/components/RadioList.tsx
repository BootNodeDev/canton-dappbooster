import { Box, Text, useInput } from 'ink'
import { type ReactElement, useState } from 'react'
import { Divider } from '#src/components/Divider'

export interface RadioOption {
  value: string
  label: string
  hint: string
}

interface RadioListProps {
  section: string
  prompt: string
  name: string
  options: RadioOption[]
  onSelect: (value: string) => void
}

/** A single choice under a divider: arrow keys move, Enter picks, and the answer replaces the list. */
export const RadioList = ({
  section,
  prompt,
  name,
  options,
  onSelect,
}: RadioListProps): ReactElement => {
  const [focused, setFocused] = useState(0)
  const [picked, setPicked] = useState<RadioOption>()

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setFocused((index) => (index - 1 + options.length) % options.length)
      }
      if (key.downArrow) {
        setFocused((index) => (index + 1) % options.length)
      }
      if (key.return) {
        const option = options[focused] as RadioOption
        setPicked(option)
        onSelect(option.value)
      }
    },
    { isActive: picked === undefined },
  )

  return (
    <Box flexDirection="column" rowGap={1}>
      <Divider title={section} />
      {picked === undefined ? (
        <Box flexDirection="column" rowGap={1}>
          <Text color="white">{prompt}</Text>
          <Box flexDirection="column">
            {options.map((option, index) => (
              <Box key={option.value} flexDirection="column">
                <Text bold={index === focused} color={index === focused ? 'green' : 'white'}>
                  {index === focused ? '❯ ' : '  '}
                  {option.label}
                </Text>
                <Text color="gray">
                  {'  '}
                  {option.hint}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <Text>
          <Text bold color="white">
            {name}:
          </Text>{' '}
          <Text bold color="green">
            {picked.label}
          </Text>
        </Text>
      )}
    </Box>
  )
}
