import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from './auth-context'
import { AppShell } from './components/admin/AppShell'
import { StaffAppShell } from './components/staff/StaffAppShell'
import { Analytics } from './pages/admin/Analytics'
import { Dashboard } from './pages/admin/Dashboard'
import { SystemActivityLogs } from './pages/admin/SystemActivityLogs'
import { UserAccounts } from './pages/admin/UserAccounts'
import { Login } from './pages/Login'
import { AppointmentSchedules } from './pages/staff/AppointmentSchedules'
import { Attendance } from './pages/staff/Attendance'
import { NoShowPredictions } from './pages/staff/NoShowPredictions'
import { PatientRecords } from './pages/staff/PatientRecords'
import { QueueList } from './pages/staff/QueueList'
import { StaffDashboard } from './pages/staff/StaffDashboard'
import { StaffReports } from './pages/staff/StaffReports'

export default function App() {
  return (
    <><InterfaceEnhancements /><Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireRole role="admin"><AppShell /></RequireRole>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UserAccounts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="activity-logs" element={<SystemActivityLogs />} />
      </Route>
      <Route path="staff" element={<RequireRole role="staff"><StaffAppShell /></RequireRole>}>
        <Route index element={<StaffDashboard />} />
        <Route path="patients" element={<PatientRecords />} />
        <Route path="appointments" element={<AppointmentSchedules />} />
        <Route path="queue" element={<QueueList />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="predictions" element={<NoShowPredictions />} />
        <Route path="reports" element={<StaffReports />} />
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes></>
  )
}

function InterfaceEnhancements() {
  const location = useLocation()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.table-scroll').forEach((region, index) => {
        region.tabIndex = 0
        region.setAttribute('role', 'region')
        if (!region.getAttribute('aria-label')) region.setAttribute('aria-label', `Scrollable data table ${index + 1}`)
      })
      document.querySelectorAll<HTMLInputElement>('input[placeholder]:not([aria-label])').forEach((input) => input.setAttribute('aria-label', input.placeholder))
      document.querySelectorAll<HTMLSelectElement>('select:not([aria-label])').forEach((select) => {
        const firstOption = select.options[0]?.text
        if (firstOption) select.setAttribute('aria-label', firstOption)
      })
      document.querySelector<HTMLElement>('main[id]')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname])

  return null
}

function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FFF9FB] text-sm font-semibold text-gray-500">Loading secure workspace...</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (session.role !== role) return <Navigate to={session.role === 'admin' ? '/' : '/staff'} replace />
  return children
}

function RoleHome() {
  const { session, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#FFF9FB] text-sm font-semibold text-gray-500">Loading secure workspace...</div>
  return <Navigate to={session ? session.role === 'admin' ? '/' : '/staff' : '/login'} replace />
}
