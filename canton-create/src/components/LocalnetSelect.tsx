import type { ReactElement } from 'react'
import { RadioList, type RadioOption } from '#src/components/RadioList'

const BAREBONES = 'barebones'

const OPTIONS: RadioOption[] = [
  { value: 'none', label: 'No localnet', hint: "You'll provide your own." },
  {
    value: BAREBONES,
    label: 'Barebones',
    hint: 'Minimal local Canton stack for developer workflows.',
  },
]

/** Whether to add the local network, asked first when `--localnet` is not given. */
export const LocalnetSelect = ({
  onChoose,
}: {
  onChoose: (localnet: boolean) => void
}): ReactElement => (
  <RadioList
    section="LocalNet Installation"
    prompt="Choose whether to install a Canton local network."
    name="LocalNet"
    options={OPTIONS}
    onSelect={(value) => onChoose(value === BAREBONES)}
  />
)
