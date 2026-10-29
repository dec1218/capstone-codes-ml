import { CalendarDays, ChevronDown, Clock3, Gauge, Sparkles, TrendingDown, UserRoundCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AttendanceBars, QueueLine } from '../../components/Charts'
import { Badge, ErrorState, MetricCard, PageHeader, PilotNotice, PrototypeNotice, SectionHeader, SkeletonRows } from '../../components/Ui'
import { fetchAdminOverview, fetchPredictions } from '../../lib/admin-data'
import type { AttendanceRecord, PredictionRecord, QueueRecord } from '../../types'

type AnalyticsTab = 'attendance' | 'queue' | 'predictions'

const tabs: { id: AnalyticsTab; label: string }[] = [
  { id: 'attendance', label: 'Attendance Records' },
  { id: 'queue', label: 'Queue Performance' },
  { id: 'predictions', label: 'No-Show Predictions' },
]

export function Analytics() {
  const [tab, setTab] = useState<AnalyticsTab>('attendance')
  const [range, setRange] = useState('Last 7 days')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [queue, setQueue] = useState<QueueRecord[]>([])
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const changeRange = (value: string) => {
    setRange(value)
  }
  const dayCount = range === 'Last 3 days' ? 3 : 7

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([fetchAdminOverview(dayCount), fetchPredictions()]).then(([overview, predictionRows]) => {
      if (!active) return
      setAttendance(overview.attendance)
      setQueue(overview.queue)
      setPredictions(predictionRows)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load analytics.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [dayCount, reloadKey])

  if (error) return <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} />

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operational insights"
        title="Analytics"
        description="Review attendance, patient flow, and prediction results without modifying operational records."
        action={
          <label className="relative block">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#c95676]" size={16} />
            <span className="sr-only">Date range</span>
            <select className="field min-w-40 appearance-none" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} value={range} onChange={(event) => changeRange(event.target.value)}>
              <option>Last 7 days</option>
              <option>Last 3 days</option>
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} aria-hidden="true" />
          </label>
        }
      />

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm" aria-label="Analytics categories">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition-colors sm:text-sm ${tab === item.id ? 'bg-[#2f3542] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-[#2f3542]'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? <div className="card"><SkeletonRows count={6} /></div> : (
        <>
          {tab === 'attendance' && <AttendanceAnalytics data={attendance} />}
          {tab === 'queue' && <QueueAnalytics data={queue} />}
          {tab === 'predictions' && <PredictionAnalytics data={predictions} />}
        </>
      )}
    </div>
  )
}

function AttendanceAnalytics({ data }: { data: AttendanceRecord[] }) {
  const total = data.reduce((sum, item) => sum + item.present + item.late + item.noShow, 0)
  const attended = data.reduce((sum, item) => sum + item.present + item.late, 0)
  const noShows = data.reduce((sum, item) => sum + item.noShow, 0)
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total appointments" value={String(total)} icon={UserRoundCheck} detail="Across the selected period" />
        <MetricCard label="Attendance rate" value={`${(total ? (attended / total) * 100 : 0).toFixed(1)}%`} icon={Gauge} tone="green" detail={`${attended} present or late records`} />
        <MetricCard label="No-show rate" value={`${(total ? (noShows / total) * 100 : 0).toFixed(1)}%`} icon={TrendingDown} tone="red" detail={`${noShows} unattended appointments`} />
      </section>
      <article className="card overflow-hidden">
        <SectionHeader title="Attendance trend" description="Present, late, and no-show outcomes by service day" action={<Badge tone="neutral">{data.length} days</Badge>} />
        <AttendanceBars data={data} />
        <div className="h-6" />
      </article>
      <article className="card overflow-hidden">
        <SectionHeader title="Daily attendance records" description="Aggregated records for the selected period" />
        <div className="table-scroll" role="region" aria-label="Attendance analytics table" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Daily attendance analytics</caption>
            <thead><tr><th>Date</th><th>Present</th><th>Late</th><th>No-show</th><th>Total</th><th>Attendance rate</th></tr></thead>
            <tbody>{data.slice().reverse().map((item) => {
              const total = item.present + item.late + item.noShow
               return <tr key={item.date}><td className="font-semibold text-[#2f3542]!">{item.date}</td><td>{item.present}</td><td>{item.late}</td><td>{item.noShow}</td><td>{total}</td><td><Badge tone="success">{total ? Math.round(((item.present + item.late) / total) * 100) : 0}%</Badge></td></tr>
            })}</tbody>
          </table>
        </div>
      </article>
    </div>
  )
}

function QueueAnalytics({ data }: { data: QueueRecord[] }) {
  const completed = data.reduce((sum, item) => sum + item.completed, 0)
  const averageWait = data.length ? data.reduce((sum, item) => sum + item.waitingMinutes, 0) / data.length : 0
  const averageCompleted = data.length ? completed / data.length : 0
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Visits completed" value={String(completed)} icon={UserRoundCheck} tone="green" detail={`Across ${data.length} service days`} />
        <MetricCard label="Average waiting time" value={`${averageWait.toFixed(1)} min`} icon={Clock3} tone="amber" detail="Across the selected period" />
        <MetricCard label="Daily completion" value={averageCompleted.toFixed(1)} icon={Gauge} tone="blue" detail="Average patients per day" />
      </section>
      <article className="card overflow-hidden">
        <SectionHeader title="Patient flow trend" description="Completed queue entries across the selected service days" action={<Badge tone="neutral">{completed} visits</Badge>} />
        <QueueLine data={data} />
        <div className="h-4" />
      </article>
      <article className="card overflow-hidden">
        <SectionHeader title="Daily queue performance" description="Completion volume and average waiting time" />
        <div className="table-scroll" role="region" aria-label="Queue analytics table" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">Daily queue performance analytics</caption>
            <thead><tr><th>Service day</th><th>Completed visits</th><th>Average wait</th><th>Flow status</th></tr></thead>
             <tbody>{data.slice().reverse().map((item) => <tr key={item.day}><td className="font-semibold text-[#2f3542]!">{item.day}</td><td>{item.completed}</td><td>{item.waitingMinutes} minutes</td><td><Badge tone={item.waitingMinutes <= 20 ? 'success' : 'warning'}>{item.waitingMinutes <= 20 ? 'Within average' : 'Above average'}</Badge></td></tr>)}</tbody>
          </table>
        </div>
      </article>
    </div>
  )
}

function PredictionAnalytics({ data }: { data: PredictionRecord[] }) {
  const noShows = data.filter((item) => item.result === 'No-Show')
  const shows = data.length - noShows.length
  const usesPilotModel = data.some((item) => item.modelVersion.includes('pilot'))
  return (
    <div className="space-y-6">
      {data.some((item) => item.modelVersion.includes('synthetic')) && <PrototypeNotice historical={usesPilotModel} />}
      {usesPilotModel && <PilotNotice />}
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Appointments reviewed" value={String(data.length)} icon={Sparkles} detail="Stored model predictions" />
        <MetricCard label="Predicted to show" value={String(shows)} icon={UserRoundCheck} tone="green" detail={`${data.length ? Math.round((shows / data.length) * 100) : 0}% of reviewed appointments`} />
        <MetricCard label="Predicted no-show" value={String(noShows.length)} icon={TrendingDown} tone="red" detail={`${data.length ? Math.round((noShows.length / data.length) * 100) : 0}% of reviewed appointments`} />
      </section>
      <article className="card overflow-hidden">
        <SectionHeader title="No-show prediction results" description="Model output shown as a result and probability score; no clinical risk level is assigned" action={<Badge tone="rose">{data.length} results</Badge>} />
        <div className="table-scroll" role="region" aria-label="No-show prediction results table" tabIndex={0}>
          <table className="data-table">
            <caption className="sr-only">No-show prediction results</caption>
            <thead><tr><th>Patient reference</th><th>Appointment</th><th>Prediction</th><th>Probability score</th><th>Model</th><th>Prediction date</th></tr></thead>
             <tbody>{data.map((item) => <tr key={`${item.patient}-${item.appointment}`}>
              <td className="font-semibold text-[#2f3542]!">{item.patient}</td>
              <td>{item.appointment}</td>
              <td><Badge tone={item.result === 'Show' ? 'success' : 'danger'}>{item.result}</Badge></td>
               <td><div className="flex min-w-36 items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${item.result === 'Show' ? 'bg-emerald-600' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.max(0, item.probability))}%` }} /></div><span className="w-9 text-end text-xs font-semibold">{item.probability}%</span></div></td>
                <td><Badge tone={item.modelVersion.includes('synthetic') ? 'warning' : 'info'}>{item.modelVersion.includes('synthetic') ? 'Prototype' : item.modelVersion.includes('pilot') ? 'Real pilot' : item.modelVersion}</Badge></td>
              <td>{item.predictedAt}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 text-xs leading-5 text-gray-500">
          Pilot display bands: Low below 40%, Moderate from 40% to below 70%, and High at 70% or above. They support staff review and do not remove standard reminder eligibility.
        </div>
      </article>
    </div>
  )
}
