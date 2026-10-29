import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FilePenLine,
  FilePlus2,
  LogIn,
  LogOut,
  MoveRight,
  ChartNoAxesCombined,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../auth-context'
import { AttendanceBars, ProgressRing, QueueLine } from '../../components/Charts'
import { Badge, ErrorState, MetricCard, PageHeader, PilotNotice, PrototypeNotice, SectionHeader, SkeletonRows } from '../../components/Ui'
import { fetchAdminOverview, type AdminOverview } from '../../lib/admin-data'
import type { ActivityAction } from '../../types'

const activityStyles: Record<ActivityAction, { icon: typeof BellRing; className: string }> = {
  Create: { icon: FilePlus2, className: 'bg-[#E7F6F1] text-[#397D6D]' },
  Update: { icon: FilePenLine, className: 'bg-[#EEF4FC] text-[#4E73A7]' },
  Delete: { icon: Trash2, className: 'bg-[#FDEBEC] text-[#B54F4F]' },
  Reminder: { icon: BellRing, className: 'bg-[#F8E4EA] text-[#B94F6D]' },
  Prediction: { icon: ChartNoAxesCombined, className: 'bg-[#F8E4EA] text-[#963C56]' },
  Login: { icon: LogIn, className: 'bg-[#E7F6F1] text-[#397D6D]' },
  Logout: { icon: LogOut, className: 'bg-gray-100 text-gray-600' },
}

export function Dashboard() {
  const { session } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    fetchAdminOverview().then((result) => {
      if (active) setOverview(result)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load dashboard data.')
    })
    return () => { active = false }
  }, [reloadKey])

  if (error) return <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} />
  if (!overview) return <div className="card"><SkeletonRows count={7} /></div>

  const attendanceTotals = overview.attendance.reduce((totals, item) => ({
    present: totals.present + item.present,
    late: totals.late + item.late,
    noShow: totals.noShow + item.noShow,
  }), { present: 0, late: 0, noShow: 0 })
  const predictedShows = Math.max(0, overview.predictedAppointments - overview.predictedNoShows)
  const unscoredAppointments = Math.max(0, overview.tomorrowAppointments - overview.predictedAppointments)
  const showRate = overview.predictedAppointments ? Math.round((predictedShows / overview.predictedAppointments) * 100) : 0
  const weeklyCompletions = overview.queue.reduce((sum, item) => sum + item.completed, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Daily overview"
        title={`Good morning, ${session?.name ?? 'Administrator'}`}
        description="Monitor today's patient flow, attendance, and appointment risks from one focused view."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm">
            <CalendarDays size={16} className="text-[#C95F7C]" aria-hidden="true" /> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        }
      />
      {overview.usesSyntheticPredictions && <PrototypeNotice historical={overview.usesPilotPredictions} />}
      {overview.usesPilotPredictions && <PilotNotice />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Today's key metrics">
        <MetricCard
          label="Patients attended"
          value={String(overview.attendedToday)}
          icon={UserRoundCheck}
          tone="green"
          detail="Present or late attendance recorded today"
        />
        <MetricCard
          label="Queue completed"
          value={String(overview.queueCompletedToday)}
          icon={CheckCircle2}
          tone="blue"
          detail={<span><strong className="font-bold text-[#4E73A7]">{overview.activeQueueToday} patients</strong> currently in queue</span>}
        />
        <MetricCard
          label="Average wait"
          value={`${overview.averageWaitToday} min`}
          icon={Clock3}
          tone="amber"
          detail="From queue creation to first call today"
        />
        <MetricCard
          label="Predicted no-shows"
          value={String(overview.predictedNoShows)}
          icon={ChartNoAxesCombined}
          tone="red"
          detail={<span><strong className="font-bold text-[#B54F4F]">{overview.predictedAppointments} of {overview.tomorrowAppointments}</strong> scheduled appointments scored</span>}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <article className="card overflow-hidden">
          <SectionHeader
            title="Attendance overview"
            description="Patient attendance across the last seven service days"
            action={<Link to="/analytics" className="btn btn-ghost min-h-9 px-2">Details <MoveRight size={16} /></Link>}
          />
          <AttendanceBars data={overview.attendance} />
          <div className="mx-5 mt-5 grid gap-4 border-t border-[#F1ECEF] py-5 min-[400px]:grid-cols-3 min-[400px]:gap-0 sm:mx-6">
            <div><p className="text-xl font-bold text-[#263238]">{attendanceTotals.present}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-[#5FAF9B]" />Present</p></div>
            <div className="min-[400px]:border-s min-[400px]:border-[#F1ECEF] min-[400px]:ps-5"><p className="text-xl font-bold text-[#263238]">{attendanceTotals.late}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-[#D8A23C]" />Late</p></div>
            <div className="min-[400px]:border-s min-[400px]:border-[#F1ECEF] min-[400px]:ps-5"><p className="text-xl font-bold text-[#263238]">{attendanceTotals.noShow}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-[#D66565]" />No-show</p></div>
          </div>
        </article>

        <article className="card overflow-hidden">
          <SectionHeader title="Tomorrow's outlook" description={`${overview.predictedAppointments} of ${overview.tomorrowAppointments} scheduled appointments have supported predictions`} />
          <div className="flex flex-col items-center gap-6 px-5 pb-5 sm:flex-row sm:px-6 xl:flex-col 2xl:flex-row">
            <ProgressRing value={showRate} label="Likely show" />
            <div className="w-full flex-1 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-[#E7F6F1] px-4 py-3">
                <span className="text-xs font-semibold text-[#397D6D]">Predicted show</span>
                <strong className="text-sm text-[#397D6D]">{predictedShows}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#FDEBEC] px-4 py-3">
                <span className="text-xs font-semibold text-[#B54F4F]">Predicted no-show</span>
                <strong className="text-sm text-[#B54F4F]">{overview.predictedNoShows}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
                <span className="text-xs font-semibold text-gray-600">Not scored</span>
                <strong className="text-sm text-gray-700">{unscoredAppointments}</strong>
              </div>
              <Link to="/analytics" className="btn btn-primary mt-1 w-full">View predictions</Link>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="card overflow-hidden">
          <SectionHeader
            title="Queue performance"
            description="Completed patient visits over seven service days"
            action={<Badge tone="neutral">{weeklyCompletions} completed</Badge>}
          />
          <QueueLine data={overview.queue} />
          <div className="mx-5 mb-5 flex items-center justify-between rounded-lg bg-[#FFF9FB] px-4 py-3 sm:mx-6">
            <span className="text-xs font-medium text-gray-500">Weekly completion average</span>
            <strong className="text-sm text-[#263238]">{(weeklyCompletions / 7).toFixed(1)} patients/day</strong>
          </div>
        </article>

        <article className="card overflow-hidden">
          <SectionHeader
            title="Recent system activity"
            description="Latest staff and automated system events"
            action={<Link to="/activity-logs" className="btn btn-ghost min-h-9 px-2" aria-label="View all system activity logs">View all <MoveRight className="size-4 shrink-0" /></Link>}
          />
          <div className="divide-y divide-gray-100 px-5 sm:px-6">
            {overview.activities.slice(0, 4).map((log) => {
              const activityStyle = activityStyles[log.action]
              const ActivityIcon = activityStyle.icon
              return (
              <div key={log.id} className="flex gap-3 py-4">
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activityStyle.className}`}>
                  <ActivityIcon className="size-[15px] shrink-0" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-bold text-[#263238]">{log.actor} · {log.action}</p>
                    <time className="shrink-0 text-[10px] text-gray-400">{log.dateTime.split(' · ')[1]}</time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{log.description}</p>
                </div>
              </div>
              )
            })}
          </div>
        </article>
      </section>

      <section className="card flex flex-col gap-5 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-[#c95676]">
            <UsersRound size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-[#263238]">Staff access is up to date</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">{overview.staffActive} active and {overview.staffTotal - overview.staffActive} inactive Health Center Staff accounts.</p>
          </div>
        </div>
        <Link to="/users" className="btn btn-secondary shrink-0">Manage accounts <MoveRight size={16} /></Link>
      </section>
    </div>
  )
}
