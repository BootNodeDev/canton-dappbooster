import type { AnchorHTMLAttributes, ReactElement, Ref } from 'react'
import { ExternalLinkIcon } from '../../icons'
import { anatomy } from './anatomy'

/** Props for {@link ExplorerLink}. */
export interface ExplorerLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'rel' | 'target'> {
  /** Required: the only content is an `aria-hidden` icon, so nothing else can name the link. */
  'aria-label': string
  /** Required: a link with nowhere to go is not rendered. */
  href: string
  ref?: Ref<HTMLAnchorElement>
}

/**
 * An icon-only external link to a block explorer. Composes no URLs — pair it with
 * `useExplorerLink` or `getExplorerLink`, which turn an identifier into an href.
 *
 * Reach for it directly when the link stands alone. Inside `Identifier` it is already the `href`
 * slot, so pass the href there instead of nesting one.
 */
export const ExplorerLink = ({
  className,
  href,
  ref,
  ...rest
}: ExplorerLinkProps): ReactElement => {
  return (
    // Spread first: `rel` and `target` are the component's contract, not a consumer's to override.
    <a
      {...rest}
      className={[anatomy.parts.root, className].filter(Boolean).join(' ')}
      href={href}
      ref={ref}
      rel="noopener noreferrer"
      target="_blank"
    >
      <ExternalLinkIcon />
    </a>
  )
}
