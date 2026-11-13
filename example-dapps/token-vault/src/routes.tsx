import type { RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { ErrorScreen } from '@/components/ErrorScreen'
import { Vault } from '@/pages/Vault'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <Vault /> },
      { path: '*', element: <EmptyState level={1} title="Page not found" /> },
    ],
  },
]
