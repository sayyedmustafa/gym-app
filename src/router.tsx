import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth, RequireGym } from '@/components/guards'
import { AppShell } from '@/components/AppShell'
import { LoginPage } from '@/pages/Login'
import { OnboardingPage } from '@/pages/Onboarding'
import { DashboardPage } from '@/pages/Dashboard'
import { MembersPage } from '@/pages/Members'
import { PlansPage } from '@/pages/Plans'
import { StaffPage } from '@/pages/Staff'
import { SettingsPage } from '@/pages/Settings'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireGym />,
        children: [
          {
            path: '/app',
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'members', element: <MembersPage /> },
              { path: 'plans', element: <PlansPage /> },
              { path: 'staff', element: <StaffPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <LoginPage />,
  },
])
