import { create } from 'zustand'
import type { Role } from './types'

export type DashboardView = 'cards' | 'table'

interface UiState {
  // The lens over the connected party's grants: as receiver vs as funder.
  role: Role
  dashboardView: DashboardView
  setRole: (role: Role) => void
  setDashboardView: (view: DashboardView) => void
}

export const useUiStore = create<UiState>((set) => ({
  role: 'receiver',
  dashboardView: 'cards',
  setRole: (role) => set({ role }),
  setDashboardView: (dashboardView) => set({ dashboardView }),
}))
