import { BootNodeMark } from '@/icons'

export const Footer = (): React.JSX.Element => (
  <footer className="flex items-center justify-center px-5 pt-8 pb-3.5 text-xs sm:justify-start sm:px-8">
    <a
      className="flex items-center gap-2 font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:text-fg"
      href="https://www.bootnode.dev/"
      rel="noopener noreferrer"
      target="_blank"
    >
      Built by
      <BootNodeMark width={19} height={16} />
      <span className="sr-only">BootNode</span>
    </a>
  </footer>
)
