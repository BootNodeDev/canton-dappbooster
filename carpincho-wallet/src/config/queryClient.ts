import { QueryClient, type QueryClientConfig } from '@tanstack/react-query'

type QueryDefaults = NonNullable<QueryClientConfig['defaultOptions']>['queries']

// Shared TanStack Query policy: server state is polled explicitly, never on focus or retry.
export const createQueryClient = (queries: QueryDefaults = {}): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        ...queries,
      },
    },
  })
