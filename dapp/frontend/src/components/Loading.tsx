import { SpinnerIcon } from '@/icons'

// Only for a first read, where there is nothing on screen yet: a refresh after a write keeps the
// stale figures rather than replacing the page with this.
export const Loading = (): React.JSX.Element => (
  <div
    role="status"
    className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-sm text-fg-muted"
  >
    <SpinnerIcon width={22} height={22} />
    Loading
  </div>
)
