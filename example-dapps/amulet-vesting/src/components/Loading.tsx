import { Spinner } from '@/components/Spinner'

export const Loading = (): React.JSX.Element => (
  <div
    role="status"
    className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-sm text-fg-muted"
  >
    <Spinner size={22} />
    Loading
  </div>
)
