import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export const NotFound = (): React.JSX.Element => (
  <EmptyState
    title="404: page not found"
    action={
      <Button asLink to="/" size="sm">
        Back to grants
      </Button>
    }
  />
)
