import { AuthCard } from '@/components/AuthCard'
import { EmptyState } from '@/components/EmptyState'

export const SignInPrompt = (): React.JSX.Element => (
  <EmptyState
    level={1}
    title="Canton Vesting"
    description="Sign in to see your grants, or create an account to get a party of your own."
    action={<AuthCard />}
  />
)
