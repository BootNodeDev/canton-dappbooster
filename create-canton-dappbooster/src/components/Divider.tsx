import { Text } from 'ink'
import type { ReactElement } from 'react'

export const SCREEN_WIDTH = 80

const TITLE_PADDING = '  '

export const Divider = ({ title }: { title: string }): ReactElement => {
  const lineLength = SCREEN_WIDTH - title.length - TITLE_PADDING.length * 2
  const left = Math.floor(lineLength / 2)
  return (
    <Text>
      <Text color="gray">{'─'.repeat(left)}</Text>
      {TITLE_PADDING}
      <Text color="whiteBright">{title}</Text>
      {TITLE_PADDING}
      <Text color="gray">{'─'.repeat(lineLength - left)}</Text>
    </Text>
  )
}
