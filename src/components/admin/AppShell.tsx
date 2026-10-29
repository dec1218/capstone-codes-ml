import {
  Activity,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth-context'
import { BrandLogo } from '../BrandLogo'

const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'User Accounts', to: '/users', icon: Users },
  { label: 'Analytics', to: '/analytics', icon: Activity },
  { label: 'Activity Logs', to: '/activity-logs', icon: ListChecks },
]

export function AppShell() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const displayName = session?.name ?? 'Althea Dumapias'
  const initials = displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  useEffect(() => {
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('keydown', closeOverlays)
    return () => document.removeEventListener('keydown', closeOverlays)
  }, [])
  useEffect(() => {
    if (!sidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [sidebarOpen])

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FFF9FB]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside id="admin-navigation" className={`fixed inset-y-0 start-0 z-50 flex w-[17rem] flex-col border-e border-[#E7E2E5] bg-white transition-[width,transform] duration-200 lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-[17rem]'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`flex h-20 items-center justify-between border-b border-[#F1ECEF] px-5 ${sidebarCollapsed ? 'lg:justify-center lg:px-3' : ''}`}>
          <NavLink to="/" className="flex min-w-0 items-center gap-3" onClick={() => setSidebarOpen(false)} title={sidebarCollapsed ? 'Smart Queue & No Show Prediction' : undefined}>
            <BrandLogo />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
              <strong className="block max-w-[10.5rem] text-sm leading-5 font-bold tracking-[-0.02em] text-[#263238]">Smart Queue &amp; No Show Prediction</strong>
              <small className="mt-0.5 block text-[10px] font-semibold tracking-[0.12em] text-gray-400 uppercase">Health Center</small>
            </span>
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6" aria-label="Main navigation">
          <p className={`px-3 pb-3 text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Administration</p>
          <div className="space-y-1">
            {navigation.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? label : undefined}
                className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} ${isActive ? 'bg-[#F8E4EA] text-[#B94F6D]' : 'text-gray-600 hover:bg-[#FFF9FB] hover:text-[#263238]'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2.3 : 1.9} aria-hidden="true" />
                    <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

      </aside>

      <div className={`transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:ps-20' : 'lg:ps-[17rem]'}`}>
        <header className="workspace-header">
          <div className="workspace-header__heading">
            <button className="workspace-header__icon workspace-header__menu grid lg:hidden" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="admin-navigation">
              <Menu size={20} aria-hidden="true" />
            </button>
            <button className="workspace-header__icon workspace-header__menu hidden lg:grid" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!sidebarCollapsed} aria-controls="admin-navigation">
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="workspace-header__titles">
              <p className="workspace-header__title">Head Nurse Workspace</p>
              <p className="workspace-header__date">{currentDate}</p>
            </div>
          </div>

          <div className="workspace-header__actions">
            <button
              className="workspace-header__account"
              type="button"
              onClick={() => setAccountOpen(!accountOpen)}
              aria-expanded={accountOpen}
              aria-label={`Open account menu for ${displayName}`}
              aria-haspopup="true"
            >
              <span className="workspace-header__avatar">{initials}</span>
              <span className="workspace-header__identity hidden sm:block">
                <strong>{displayName}</strong>
                <small>Head Nurse (Admin)</small>
              </span>
              <ChevronDown size={15} className="hidden text-gray-400 sm:block" aria-hidden="true" />
            </button>

            {accountOpen && (
              <div className="card absolute end-0 top-14 w-56 p-2 shadow-xl" role="group" aria-label="Account actions">
                <div className="border-b border-gray-100 px-3 py-2.5 sm:hidden">
                  <p className="text-xs font-bold text-[#263238]">{displayName}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">Head Nurse (Admin)</p>
                </div>
                <button className="btn btn-ghost w-full justify-start text-[#B54F4F] hover:bg-[#FDEBEC] hover:text-[#9D4141]" type="button" onClick={signOut}>
                  <LogOut size={17} aria-hidden="true" /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto max-w-[96rem] px-4 py-[clamp(1.5rem,4vw,2.5rem)] sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
