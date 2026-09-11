import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { useParty } from '@/hooks/useParty'
import { useBackend } from '@/providers/Backend'
import { useVestingStore } from '@/store/useVestingStore'

// A failed read keeps the rows the last good one returned, which is what stops a write's own refresh
// blanking the page; without this the failure would reach nobody and those rows would read as
// current. Mounted by the shell rather than per page, because the store is what every page renders.
export const ReadError = (): React.JSX.Element | null => {
  const error = useVestingStore((s) => s.error)
  const loading = useVestingStore((s) => s.loading)
  const refresh = useVestingStore((s) => s.refresh)
  const { backend } = useBackend()
  const { party } = useParty()

  if (error === undefined || backend === undefined || party === undefined) {
    return null
  }

  return (
    <Card role="alert" className="mb-6 flex flex-wrap items-center gap-3 px-5 py-4">
      <p className="min-w-60 flex-1 text-sm text-fg-muted">
        <span className="font-semibold text-danger">This page may be out of date. </span>
        {error}
      </p>
      <Button
        variant="secondary"
        size="sm"
        pending={loading}
        onClick={() => void refresh(backend, party.partyId)}
      >
        Try again
      </Button>
    </Card>
  )
}
