import type { HTMLAttributes, ReactElement } from 'react'
import { cx } from '../../utils/cx'
import { anatomy } from './anatomy'

/** Props for {@link PartyIdInput}. */
export type PartyIdInputProps = HTMLAttributes<HTMLDivElement>

/** TODO: what it does, and when to reach for it over a sibling export. */
export const PartyIdInput = ({ children, className, ...rest }: PartyIdInputProps): ReactElement => (
  <div {...rest} className={cx(anatomy.parts.root, className)}>
    {children}
  </div>
)
