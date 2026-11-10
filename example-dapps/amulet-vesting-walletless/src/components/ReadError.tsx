import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'

export const ReadError = (): React.JSX.Element | null => {
  const error = useVestingStore((s) => s.error)
  const loading = useVestingStore((s) => s.loading)
  const refresh = useVestingStore((s) => s.refresh)
  const { ready } = useBackend()

  if (error === undefined || !ready) {
    return null
  }

  return (
    <Card role="alert" className="mb-6 flex flex-wrap items-center gap-3 px-5 py-4">
      <p className="min-w-60 flex-1 text-sm text-fg-muted">
        <span className="font-semibold text-danger">This page may be out of date. </span>
        {error}
      </p>
      <Button variant="secondary" size="sm" pending={loading} onClick={() => void refresh()}>
        Try again
      </Button>
    </Card>
  )
}
