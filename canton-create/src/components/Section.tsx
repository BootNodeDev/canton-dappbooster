import { Spinner } from '@inkjs/ui'
import { Box, Text } from 'ink'
import { type ReactElement, useEffect, useState } from 'react'
import { Divider } from '#src/components/Divider'

export interface Progress {
  step: (label: string) => void
  warn: (message: string) => void
}

export interface SectionProps {
  title: string
  run: (progress: Progress) => Promise<void>
  onDone: () => void
  onError: (error: unknown) => void
}

type Line = { kind: 'step' | 'warning'; text: string }
type Status = 'running' | 'done' | 'failed'

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const StepLine = ({ text, status }: { text: string; status: Status }): ReactElement => {
  if (status === 'running') {
    return <Spinner label={text} />
  }
  return status === 'done' ? (
    <Text>
      <Text color="green">✔</Text> {text}
    </Text>
  ) : (
    <Text>
      <Text color="red">✗</Text> {text} <Text color="red">Error</Text>
    </Text>
  )
}

/** One phase of the run: a divider, then a line per step, the last one live until `run` settles. */
export const Section = ({ title, run, onDone, onError }: SectionProps): ReactElement => {
  const [lines, setLines] = useState<Line[]>([])
  const [status, setStatus] = useState<Status>('running')
  const [failure, setFailure] = useState<{ reason: unknown }>()

  useEffect(() => {
    const add = (kind: Line['kind']) => (text: string) =>
      setLines((previous) => [...previous, { kind, text }])
    run({ step: add('step'), warn: add('warning') }).then(
      () => setStatus('done'),
      (reason: unknown) => {
        setStatus('failed')
        setFailure({ reason })
      },
    )
  }, [run])

  // Reported from an effect so the error is on screen before the app exits.
  useEffect(() => {
    if (status === 'done') {
      onDone()
    }
    if (failure !== undefined) {
      onError(failure.reason)
    }
  }, [status, failure, onDone, onError])

  const lastStep = lines.findLastIndex((line) => line.kind === 'step')

  return (
    <Box flexDirection="column" rowGap={1}>
      <Divider title={title} />
      <Box flexDirection="column">
        {lines.map((line, index) =>
          line.kind === 'warning' ? (
            <Text key={`warning:${line.text}`}>
              <Text color="yellow">⚠</Text> {line.text}
            </Text>
          ) : (
            <StepLine
              key={`step:${line.text}`}
              text={line.text}
              status={index === lastStep ? status : 'done'}
            />
          ),
        )}
        {failure !== undefined && <Text color="red">{messageOf(failure.reason)}</Text>}
      </Box>
    </Box>
  )
}
