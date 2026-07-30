import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { CreateGrantPage } from '@/features/CreateGrantPage'
import { DashboardPage } from '@/features/DashboardPage'
import { GrantDetailPage } from '@/features/GrantDetailPage'
import { ProposalsPage } from '@/features/ProposalsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'proposals', element: <ProposalsPage /> },
      { path: 'create', element: <CreateGrantPage /> },
      { path: 'grants/:id', element: <GrantDetailPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]
