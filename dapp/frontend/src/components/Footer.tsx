import type { ReactNode } from 'react'
import { BootNodeMark, DocsMark, GithubMark, LinkedInMark, TelegramMark, XMark } from '@/icons'
import { cn } from '@/utils/cn'

const BOOTNODE = 'https://www.bootnode.dev/'

const socials = [
  { label: 'Telegram', href: 'https://t.me/dAppBooster', Icon: TelegramMark },
  { label: 'GitHub', href: 'https://github.com/BootNodeDev', Icon: GithubMark },
  { label: 'Twitter/X', href: 'https://twitter.com/bootnodedev', Icon: XMark },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/bootnode-dev/', Icon: LinkedInMark },
]

const resources = [
  {
    label: 'GitHub',
    href: 'https://github.com/BootNodeDev/canton-dappbooster',
    Icon: GithubMark,
  },
  { label: 'Docs', href: 'https://docs.dappbooster.cc/', Icon: DocsMark },
]

const Outbound = ({
  children,
  className,
  href,
  label,
}: {
  children: ReactNode
  className?: string
  href: string
  label?: string
}): React.JSX.Element => (
  <a
    aria-label={label}
    className={cn('text-fg-muted transition-colors hover:text-fg focus-visible:text-fg', className)}
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
  </a>
)

export const Footer = (): React.JSX.Element => (
  <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-5 pt-8 pb-3.5 text-xs sm:justify-between sm:px-8">
    <div className="flex items-center gap-4">
      <Outbound className="flex items-center gap-2 font-semibold" href={BOOTNODE}>
        Built by
        <BootNodeMark width={19} height={16} />
        {/* The mark is the only thing naming the destination, and it is aria-hidden. */}
        <span className="sr-only">BootNode</span>
      </Outbound>
      <nav
        aria-label="Social media"
        className="flex items-center gap-1 border-l border-border pl-3"
      >
        {socials.map(({ label, href, Icon }) => (
          <Outbound
            className="inline-flex size-8 items-center justify-center"
            href={href}
            key={label}
            label={label}
          >
            <Icon width={17} height={17} />
          </Outbound>
        ))}
      </nav>
    </div>
    <nav aria-label="Resources" className="hidden items-center gap-6 font-semibold sm:flex">
      {resources.map(({ label, href, Icon }) => (
        <Outbound className="inline-flex items-center gap-2" href={href} key={label}>
          <Icon width={15} height={15} />
          {label}
        </Outbound>
      ))}
    </nav>
  </footer>
)
