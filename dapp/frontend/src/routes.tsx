import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ErrorScreen } from '@/components/ErrorScreen'
import { Dashboard } from '@/pages/Dashboard'
import { GrantDetail } from '@/pages/GrantDetail'
import { NotFound } from '@/pages/NotFound'
import { Proposals } from '@/pages/Proposals'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'proposals', element: <Proposals /> },
      { path: 'create', element: <Navigate to="/?create=1" replace /> },
      { path: 'grants/:id', element: <GrantDetail /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
