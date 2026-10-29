import { CalendarDays, ChartNoAxesCombined, ClipboardCheck, Clock3, ListOrdered, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth-context'
import { Badge, ErrorState, MetricCard, PageHeader, PilotNotice, PrototypeNotice, SectionHeader, SkeletonRows } from '../../components/Ui'
import { formatTime } from '../../formatters'
import { fetchStaffOverview, type StaffOverview } from '../../lib/staff-data'

const quickActions = [
  { label: 'Register patient', description: 'Add a new patient record', to: '/staff/patients', icon: UserPlus },
  { label: 'Create appointment', description: 'Schedule a health service', to: '/staff/appointments', icon: CalendarDays },
  { label: 'View queue', description: 'Manage today’s patient flow', to: '/staff/queue', icon: ListOrdered },
  { label: 'Record attendance', description: 'Mark appointment attendance', to: '/staff/attendance', icon: ClipboardCheck },
]

export function StaffDashboard() {
  const { session } = useAuth()
  const [overview, setOverview] = useState<StaffOverview | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    fetchStaffOverview().then((result) => { if (active) setOverview(result) }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the staff dashboard.')
    })
    return () => { active = false }
  }, [reloadKey])

  if (error) return <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} />
  if (!overview) return <div className="card"><SkeletonRows count={7} /></div>

  const scheduled = overview.appointments.filter((item) => item.status === 'Scheduled')
  const countQueue = (status: 'Waiting' | 'Serving' | 'Completed') => overview.queue.filter((item) => item.status === status).length
  const attended = overview.attendance.filter((item) => item.status !== 'No-Show').length
  const completedAppointments = overview.appointments.filter((item) => item.status === 'Completed').length
  const cancelledAppointments = overview.appointments.filter((item) => item.status === 'Cancelled').length

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Today’s operations" title={`Good morning, ${session?.name ?? 'Staff'}`} description="Keep appointments, patient flow, and attendance moving from one daily workspace." action={<div className="flex items-center justify-center gap-2 rounded-lg border border-[#E7E2E5] bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"><CalendarDays className="size-4 text-[#C95F7C]" />{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>} />
      {overview.usesSyntheticPredictions && <PrototypeNotice historical={overview.usesPilotPredictions} />}
      {overview.usesPilotPredictions && <PilotNotice />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Daily summary">
        <MetricCard label="Today’s appointments" value={String(overview.appointments.length)} icon={CalendarDays} detail={`${completedAppointments} completed · ${scheduled.length} scheduled · ${cancelledAppointments} cancelled`} />
        <MetricCard label="Currently waiting" value={String(countQueue('Waiting'))} icon={UsersRound} tone="amber" detail={`${countQueue('Serving')} patient currently being served`} />
        <MetricCard label="Attendance recorded" value={String(overview.attendance.length)} icon={ClipboardCheck} tone="green" detail={`${attended} attended · ${overview.attendance.length - attended} no-show`} />
        <MetricCard label="High no-show risk" value={String(overview.highRisk)} icon={ChartNoAxesCombined} tone="red" detail="Available after the prediction model runs" />
      </section>

      <section>
        <div className="mb-4"><h2 className="text-base font-bold tracking-[-0.01em] text-[#263238]">Quick access</h2><p className="mt-1 text-sm text-gray-500">Start the most common front-desk tasks.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map(({ label, description, to, icon: Icon }, index) => <Link key={label} to={to} className={`card quick-action ${index === 0 ? 'quick-action--primary' : ''}`}><span className="quick-action__icon"><Icon className="size-5" strokeWidth={1.75} aria-hidden="true" /></span><span className="min-w-0"><strong className="block text-sm font-semibold text-[#263238]">{label}</strong><small className="mt-1 block text-xs leading-5 text-gray-500">{description}</small></span></Link>)}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="card overflow-hidden">
          <SectionHeader title="Today’s schedule" description="Upcoming appointments that still need service" action={<Link className="btn btn-ghost min-h-9 px-2" to="/staff/appointments">View all</Link>} />
          {scheduled.length === 0 ? <p className="px-6 pb-6 text-sm text-gray-500">No scheduled appointments remain today.</p> : <div className="divide-y divide-gray-100 px-5 sm:px-6">{scheduled.map((appointment) => <div key={appointment.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-4 sm:grid-cols-[4rem_auto_1fr_auto] sm:gap-4"><div><p className="text-sm font-bold text-[#263238]">{formatTime(appointment.time)}</p><p className="mt-0.5 text-[10px] text-gray-400">{appointment.appointmentCode}</p></div><span className="hidden h-9 w-px bg-[#F1CCD7] sm:block" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#263238]">{appointment.patientName}</p><p className="mt-1 truncate text-xs text-gray-500">{appointment.serviceName}</p></div><Badge tone="rose">Scheduled</Badge></div>)}</div>}
        </article>
        <article className="card overflow-hidden">
          <SectionHeader title="Queue status" description="Current view of today’s patient flow" action={<Badge tone="success">Live data</Badge>} />
          <div className="grid gap-3 px-5 pb-5 min-[400px]:grid-cols-3 sm:px-6">{[
            ['Waiting', countQueue('Waiting'), 'bg-[#FFF4D8] text-[#916715]'],
            ['Serving', countQueue('Serving'), 'bg-[#EEF4FC] text-[#4E73A7]'],
            ['Completed', countQueue('Completed'), 'bg-[#E7F6F1] text-[#397D6D]'],
          ].map(([label, value, style]) => <div key={String(label)} className={`rounded-xl p-4 text-center ring-1 ring-inset ring-black/[0.03] ${style}`}><strong className="block text-2xl">{value}</strong><span className="mt-1 block text-[10px] font-semibold tracking-wide uppercase sm:text-xs">{label}</span></div>)}</div>
          <div className="mx-5 mb-5 flex items-center justify-between rounded-lg bg-[#FFF9FB] px-4 py-3 sm:mx-6"><span className="flex items-center gap-2 text-xs text-gray-500"><Clock3 className="size-4" />Average wait</span><strong className="text-sm text-[#263238]">{overview.averageWait} minutes</strong></div>
        </article>
      </section>
    </div>
  )
}
