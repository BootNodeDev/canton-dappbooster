import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createQueryClient } from '@/config/queryClient'

// Creates an isolated query cache so tests cannot share CIP-56 server state.
export const createTestQueryClient = (): QueryClient => createQueryClient({ gcTime: 0 })

// Wraps a test subtree in a fresh TanStack Query provider.
export const TestQueryClientProvider = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
)
