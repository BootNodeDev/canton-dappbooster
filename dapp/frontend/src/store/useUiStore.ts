import { create } from 'zustand'
import type { Role } from '@/store/types'

export type DashboardView = 'cards' | 'table'

interface UiState {
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
