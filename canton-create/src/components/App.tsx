import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defaultTheme, extendTheme, ThemeProvider } from '@inkjs/ui'
import { Box, useApp } from 'ink'
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { SCREEN_WIDTH } from '#src/components/Divider'
import { PostInstall } from '#src/components/PostInstall'
import { ProjectName } from '#src/components/ProjectName'
import { type Progress, Section } from '#src/components/Section'
import { TierSelect } from '#src/components/TierSelect'
import { Title } from '#src/components/Title'
import { createEnvFile } from '#src/env'
import { fetchExample, resolveExampleSpec } from '#src/example'
import { gitSkipReason, initGit } from '#src/git'
import { install as installPackages, type PackageManager } from '#src/packageManager'
import { missingPrerequisites } from '#src/prerequisites'
import { removeScaffold } from '#src/projectDirectory'
import { scaffold, scaffoldFromTemplate, type Tier } from '#src/scaffold'

const theme = extendTheme(defaultTheme, {
  components: {
    Select: {
      styles: {
        focusIndicator: () => ({ color: 'green' }),
        label: ({ isFocused }: { isFocused: boolean }) => ({
          color: isFocused ? 'green' : 'white',
          bold: isFocused,
        }),
      },
    },
    Spinner: { styles: { frame: () => ({ color: 'green' }) } },
  },
})

export interface AppProps {
  directory?: string
  tier?: Tier
  example?: string
  scaffoldDir: string
  manager: PackageManager
  install: boolean
  git: boolean
}

interface Plan {
  directory: string
  tier: Tier | undefined
  example: string | undefined
  scaffoldDir: string
  manager: PackageManager
  install: boolean
  git: boolean
}

interface SectionPlan {
  title: string
  run: (progress: Progress) => Promise<void>
}

const addEnvFile = (progress: Progress, targetDir: string): void => {
  if (createEnvFile(targetDir)) {
    progress.step('Created .env from .env.example')
  }
}

const sectionsFor = (plan: Plan): SectionPlan[] => {
  const targetDir = path.resolve(plan.directory)
  const projectName = path.basename(targetDir)
  const { example, tier, manager } = plan
  const sections: SectionPlan[] = []

  if (example === undefined) {
    sections.push({
      title: 'Scaffold',
      run: async (progress) => {
        progress.step(`Copying the ${tier} template into ${plan.directory}`)
        scaffold({ projectName, targetDir, scaffoldDir: plan.scaffoldDir, tier: tier as Tier })
        addEnvFile(progress, targetDir)
      },
    })
  } else {
    sections.push({
      title: 'Example',
      run: async (progress) => {
        const spec = resolveExampleSpec(example)
        progress.step(`Fetching ${spec}`)
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canton-example-'))
        try {
          const templateDir = await fetchExample(spec, workDir)
          progress.step(`Copying it into ${plan.directory}`)
          scaffoldFromTemplate({ projectName, targetDir, templateDir })
        } finally {
          fs.rmSync(workDir, { recursive: true, force: true })
        }
        addEnvFile(progress, targetDir)
      },
    })
  }

  if (tier === 'localnet') {
    sections.push({
      title: 'Prerequisites',
      run: async (progress) => {
        progress.step('Checking for Docker and dpm')
        for (const warning of await missingPrerequisites()) {
          progress.warn(warning)
        }
        if (manager !== 'pnpm') {
          progress.warn(
            'The local stack scripts (scripts/dev-stack.sh) drive pnpm; install it too.',
          )
        }
      },
    })
  }

  if (plan.install) {
    sections.push({
      title: 'Installation',
      run: async (progress) => {
        progress.step(`Installing packages with ${manager}`)
        await installPackages(manager, targetDir)
      },
    })
  }

  if (plan.git) {
    sections.push({
      title: 'Git',
      run: async (progress) => {
        const skipReason = await gitSkipReason(targetDir)
        if (skipReason !== undefined) {
          progress.warn(skipReason)
          return
        }
        progress.step('Creating a git repository with a first commit')
        if (!(await initGit(targetDir))) {
          progress.warn('git init or the first commit failed, so the project has no repository.')
        }
      },
    })
  }

  return sections
}

/** The whole run: title, the questions the flags left open, each section in turn, then next steps. */
export const App = ({
  directory: givenDirectory,
  tier: givenTier,
  example,
  scaffoldDir,
  manager,
  install,
  git,
}: AppProps): ReactElement => {
  const { exit } = useApp()
  const [directory, setDirectory] = useState(givenDirectory)
  const [tier, setTier] = useState(givenTier)
  const [finished, setFinished] = useState(0)

  const ready = directory !== undefined && (example !== undefined || tier !== undefined)
  const existedBefore = useMemo(
    () => directory !== undefined && fs.existsSync(path.resolve(directory)),
    [directory],
  )
  const sections = useMemo(
    () =>
      ready ? sectionsFor({ directory, tier, example, scaffoldDir, manager, install, git }) : [],
    [ready, directory, tier, example, scaffoldDir, manager, install, git],
  )
  const done = ready && finished === sections.length

  const next = useCallback(() => setFinished((count) => count + 1), [])
  const fail = useCallback(
    (error: unknown) => {
      if (directory !== undefined) {
        removeScaffold(path.resolve(directory), existedBefore)
      }
      exit(error instanceof Error ? error : new Error(String(error)))
    },
    [directory, existedBefore, exit],
  )

  useEffect(() => {
    if (done) {
      exit()
    }
  }, [done, exit])

  return (
    <ThemeProvider theme={theme}>
      <Box flexDirection="column" rowGap={1} width={SCREEN_WIDTH}>
        <Title />
        {givenDirectory === undefined && <ProjectName onSubmit={setDirectory} />}
        {directory !== undefined && example === undefined && givenTier === undefined && (
          <TierSelect onSelect={setTier} />
        )}
        {sections.slice(0, finished + 1).map((section) => (
          <Section
            key={section.title}
            title={section.title}
            run={section.run}
            onDone={next}
            onError={fail}
          />
        ))}
        {done && directory !== undefined && (
          <PostInstall directory={directory} tier={tier} manager={manager} installed={install} />
        )}
      </Box>
    </ThemeProvider>
  )
}
