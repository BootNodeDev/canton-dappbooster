import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defaultTheme, extendTheme, ThemeProvider } from '@inkjs/ui'
import { Box, useApp, useInput, useStdin } from 'ink'
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { STARTER } from '#src/apps'
import { CancelledError } from '#src/CancelledError'
import { AppSelect } from '#src/components/AppSelect'
import { SCREEN_WIDTH } from '#src/components/Divider'
import { LocalnetSelect } from '#src/components/LocalnetSelect'
import { PostInstall } from '#src/components/PostInstall'
import { ProjectName } from '#src/components/ProjectName'
import { type Progress, Section } from '#src/components/Section'
import { Title } from '#src/components/Title'
import { createEnvFile } from '#src/env'
import { fetchExample, resolveExampleSpec } from '#src/example'
import { gitSkipReason, initGit } from '#src/git'
import { install as installPackages, type PackageManager } from '#src/packageManager'
import { firstMissingFolder, readProject, removeScaffold } from '#src/projectDirectory'
import { scaffold } from '#src/scaffold'

const theme = extendTheme(defaultTheme, {
  components: {
    Spinner: { styles: { frame: () => ({ color: 'green' }) } },
  },
})

export interface AppProps {
  directory?: string
  app?: string
  localnet?: boolean
  scaffoldDir: string
  manager: PackageManager
  install: boolean
  git: boolean
}

interface Plan {
  signal: AbortSignal
  directory: string
  app: string
  localnet: boolean
  scaffoldDir: string
  manager: PackageManager
  install: boolean
  git: boolean
}

interface SectionPlan {
  title: string
  run: (progress: Progress) => Promise<void>
}

const sectionsFor = (plan: Plan): SectionPlan[] => {
  const targetDir = path.resolve(plan.directory)
  const projectName = path.basename(targetDir)
  const { app, manager } = plan
  const sections: SectionPlan[] = [
    {
      title: 'Scaffold',
      run: async (progress) => {
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canton-example-'))
        try {
          let appDir = path.join(plan.scaffoldDir, STARTER)
          if (app !== STARTER) {
            const spec = resolveExampleSpec(app)
            progress.step(`Fetching ${spec}`)
            appDir = await fetchExample(spec, workDir, undefined, plan.signal)
          }
          progress.step(`Copying ${app} into ${plan.directory}`)
          scaffold({
            projectName,
            targetDir,
            appDir,
            scaffoldDir: plan.scaffoldDir,
            localnet: plan.localnet,
          })
        } finally {
          fs.rmSync(workDir, { recursive: true, force: true })
        }
        if (createEnvFile(targetDir)) {
          progress.step('Created .env from .env.example')
        }
      },
    },
  ]

  if (plan.install) {
    sections.push({
      title: 'Installation',
      run: async (progress) => {
        progress.step(`Installing packages with ${manager}`)
        await installPackages(manager, targetDir, plan.signal)
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

  // A cancelled step shows why it stopped, whatever error the abort raised inside it.
  return sections.map((section) => ({
    ...section,
    run: (progress) =>
      section.run(progress).catch((error: unknown) => {
        throw plan.signal.aborted ? plan.signal.reason : error
      }),
  }))
}

/** The whole run: title, the questions the flags left open, each section in turn, then next steps. */
export const App = ({
  directory: givenDirectory,
  app: givenApp,
  localnet: givenLocalnet,
  scaffoldDir,
  manager,
  install,
  git,
}: AppProps): ReactElement => {
  const { exit } = useApp()
  const { isRawModeSupported } = useStdin()
  const controller = useMemo(() => new AbortController(), [])
  const [directory, setDirectory] = useState(givenDirectory)
  const [app, setApp] = useState(givenApp)
  const [localnet, setLocalnet] = useState(givenLocalnet)
  const [finished, setFinished] = useState(0)

  const ready = directory !== undefined && app !== undefined && localnet !== undefined
  const created = useMemo(
    () => (directory !== undefined ? firstMissingFolder(path.resolve(directory)) : undefined),
    [directory],
  )
  const sections = useMemo(
    () =>
      ready
        ? sectionsFor({
            signal: controller.signal,
            directory,
            app,
            localnet,
            scaffoldDir,
            manager,
            install,
            git,
          })
        : [],
    [controller, ready, directory, app, localnet, scaffoldDir, manager, install, git],
  )
  const done = ready && finished === sections.length
  const project = useMemo(
    () => (done && directory !== undefined ? readProject(path.resolve(directory)) : undefined),
    [done, directory],
  )

  const fail = useCallback(
    (error: unknown) => {
      if (directory !== undefined) {
        removeScaffold(path.resolve(directory), created)
      }
      exit(error instanceof Error ? error : new Error(String(error)))
    },
    [directory, created, exit],
  )
  // A step the abort cannot stop still finishes, and no step starts after it.
  const next = useCallback(() => {
    if (controller.signal.aborted) {
      fail(controller.signal.reason)
      return
    }
    setFinished((count) => count + 1)
  }, [controller, fail])

  const cancel = useCallback(() => {
    if (!ready || done) {
      exit(new CancelledError())
      return
    }
    controller.abort(new CancelledError())
  }, [controller, ready, done, exit])
  // In raw mode Ctrl-C arrives as a key; without a terminal it arrives as SIGINT.
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        cancel()
      }
    },
    { isActive: isRawModeSupported },
  )
  useEffect(() => {
    process.on('SIGINT', cancel)
    return () => {
      process.off('SIGINT', cancel)
    }
  }, [cancel])

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
        {directory !== undefined && givenLocalnet === undefined && (
          <LocalnetSelect onChoose={setLocalnet} />
        )}
        {directory !== undefined && localnet !== undefined && givenApp === undefined && (
          <AppSelect onSelect={setApp} />
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
        {project !== undefined && directory !== undefined && localnet !== undefined && (
          <PostInstall
            directory={directory}
            starter={app === STARTER}
            localnet={localnet}
            manager={manager}
            installed={install}
            project={project}
          />
        )}
      </Box>
    </ThemeProvider>
  )
}
