import { SPINNER_ICON } from '@/components/ui/icons'

interface LoadingStateProps {
  // Accessible name for the status region; screen readers announce it while the spinner shows.
  label?: string
}

// Centered spinner for tab bodies waiting on their first fetch, so they never read as blank.
export const LoadingState = ({ label = 'Loading' }: LoadingStateProps): JSX.Element => (
  <div
    role="status"
    aria-label={label}
    className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-muted-foreground"
  >
    {SPINNER_ICON}
  </div>
)
