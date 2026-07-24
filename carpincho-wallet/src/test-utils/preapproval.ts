import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'

// Inert stub for tests that don't exercise the toggle.
export const inactivePreapprovalApi: AmuletPreapprovalApi = {
  getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
  createAmuletPreapproval: async () => ({ updateId: 'noop' }),
  cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
}
