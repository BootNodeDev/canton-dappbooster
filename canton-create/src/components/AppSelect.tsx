import type { ReactElement } from 'react'
import { APPS } from '#src/apps'
import { RadioList } from '#src/components/RadioList'

/** The dApp to start from, the starter or an example, asked when `--example` is not given. */
export const AppSelect = ({ onSelect }: { onSelect: (app: string) => void }): ReactElement => (
  <RadioList
    section="dApp Installation"
    prompt="Choose the dApp your project starts from."
    name="dApp"
    options={APPS}
    onSelect={onSelect}
  />
)
