import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { GrantDetail } from '@/pages/GrantDetail'
import { Proposals } from '@/pages/Proposals'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'proposals', element: <Proposals /> },
      { path: 'create', element: <Navigate to="/?create=1" replace /> },
      { path: 'grants/:id', element: <GrantDetail /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
