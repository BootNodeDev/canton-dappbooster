import path from 'node:path'
import { TextInput } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { type ReactElement, useState } from 'react'
import { isEmptyDir } from '#src/projectDirectory'

const problemWith = (name: string): string | undefined => {
  if (name === '') {
    return 'A project name is required.'
  }
  if (!isEmptyDir(path.resolve(name))) {
    return `${name} exists and is not empty.`
  }
  return undefined
}

/** Asks for the folder when the command line names none. */
export const ProjectName = ({
  onSubmit,
}: {
  onSubmit: (directory: string) => void
}): ReactElement => {
  const [answer, setAnswer] = useState<string>()
  const [error, setError] = useState<string>()

  const submit = (value: string): void => {
    const name = value.trim()
    const problem = problemWith(name)
    setError(problem)
    if (problem === undefined) {
      setAnswer(name)
      onSubmit(name)
    }
  }

  return (
    <Box flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        <Box>
          <Text color="whiteBright">Project name: </Text>
          {answer === undefined ? (
            <TextInput placeholder="my-canton-dapp" onSubmit={submit} />
          ) : (
            <Text bold color="green">
              {answer}
            </Text>
          )}
        </Box>
        <Text color="gray">The folder to create the project in, new or empty.</Text>
      </Box>
      {error !== undefined && (
        <Text bold color="red">
          {error}
        </Text>
      )}
    </Box>
  )
}
