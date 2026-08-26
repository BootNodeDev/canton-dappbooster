import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export const NotFound = (): React.JSX.Element => {
  useDocumentTitle('Page not found')

  return (
    <EmptyState
      level={1}
      title="404: page not found"
      action={
        <Button asLink to="/" size="sm">
          Back to grants
        </Button>
      }
    />
  )
}
