import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserCog,
  Settings,
  LogOut,
  ChevronDown,
  Dumbbell,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/members', icon: Users, label: 'Members' },
  { to: '/app/plans', icon: CreditCard, label: 'Plans', ownerOnly: true },
  { to: '/app/staff', icon: UserCog, label: 'Staff', ownerOnly: true },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
]

export function AppShell() {
  const { profile, gyms, currentGymId, setCurrentGymId, isOwner, reset } = useAuthStore()
  const navigate = useNavigate()
  const currentGym = gyms.find((g) => g.id === currentGymId)

  async function handleSignOut() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        {/* Gym switcher */}
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            {currentGym?.logo_url ? (
              <img src={currentGym.logo_url} alt="Logo" className="h-5 w-5 rounded object-cover" />
            ) : (
              <Dumbbell className="h-5 w-5 text-primary" />
            )}
            {gyms.length <= 1 ? (
              <span className="font-semibold truncate">{currentGym?.name ?? 'My Gym'}</span>
            ) : (
              <select
                value={currentGymId ?? ''}
                onChange={(e) => setCurrentGymId(e.target.value)}
                className="flex-1 truncate bg-transparent font-semibold outline-none"
              >
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            {gyms.length > 1 && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems
            .filter((item) => !item.ownerOnly || isOwner())
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
        </nav>

        {/* User footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{profile?.full_name?.[0] ?? '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{profile?.full_name ?? profile?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{isOwner() ? 'Owner' : 'Staff'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b p-4 md:hidden">
          <div className="flex items-center gap-2">
            {currentGym?.logo_url ? (
              <img src={currentGym.logo_url} alt="Logo" className="h-5 w-5 rounded object-cover" />
            ) : (
              <Dumbbell className="h-5 w-5 text-primary" />
            )}
            <span className="font-semibold">{currentGym?.name ?? 'My Gym'}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-card py-2 md:hidden">
        {navItems
          .filter((item) => !item.ownerOnly || isOwner())
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
      </nav>
    </div>
  )
}
