import {
  BellRing,
  CalendarDays,
  FilePenLine,
  FilePlus2,
  ListChecks,
  LogIn,
  LogOut,
  Search,
  Sparkles,
  Trash2,
  UserRoundCog,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge, EmptyState, ErrorState, MetricCard, PageHeader, SkeletonRows } from '../../components/Ui'
import { fetchActivityLogs } from '../../lib/admin-data'
import type { ActivityAction, ActivityLog } from '../../types'

const actionIcons: Record<ActivityAction, LucideIcon> = {
  Create: FilePlus2,
  Update: FilePenLine,
  Delete: Trash2,
  Login: LogIn,
  Logout: LogOut,
  Reminder: BellRing,
  Prediction: Sparkles,
}

const actionTones = {
  Create: 'success',
  Update: 'info',
  Delete: 'danger',
  Login: 'neutral',
  Logout: 'neutral',
  Reminder: 'rose',
  Prediction: 'info',
} as const

export function SystemActivityLogs() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All log types')
  const [action, setAction] = useState('All actions')
  const [module, setModule] = useState('All modules')
  const [actor, setActor] = useState('All users')
  const [date, setDate] = useState('All dates')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchActivityLogs().then((rows) => {
      if (active) setActivityLogs(rows)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load activity logs.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [reloadKey])

  const actions = [...new Set(activityLogs.map((log) => log.action))]
  const modules = [...new Set(activityLogs.map((log) => log.module))]
  const actors = [...new Set(activityLogs.map((log) => log.actor))]
  const dates = [...new Set(activityLogs.map((log) => log.dateTime.split(' · ')[0]))]
  const filteredLogs = activityLogs.filter((log) => {
    const queryMatch = `${log.actor} ${log.action} ${log.module} ${log.description}`.toLowerCase().includes(query.toLowerCase())
    const typeMatch = type === 'All log types' || log.type === type
    const actionMatch = action === 'All actions' || log.action === action
    const moduleMatch = module === 'All modules' || log.module === module
    const actorMatch = actor === 'All users' || log.actor === actor
    const dateMatch = date === 'All dates' || log.dateTime.startsWith(date)
    return queryMatch && typeMatch && actionMatch && moduleMatch && actorMatch && dateMatch
  })

  const staffActivityCount = activityLogs.filter((log) => log.type === 'Staff Activity').length
  const systemActivityCount = activityLogs.length - staffActivityCount

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Accountability and monitoring"
        title="System Activity Logs"
        description="Review staff changes and automated system events across documented health center workflows."
        action={<div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" /> Activity tracking active</div>}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Activity summary">
        <MetricCard label="Total events" value={String(activityLogs.length)} icon={ListChecks} detail="Across the current activity period" />
        <MetricCard label="Staff activities" value={String(staffActivityCount)} icon={UserRoundCog} tone="blue" detail="Create, update, and delete actions" />
        <MetricCard label="System activities" value={String(systemActivityCount)} icon={Sparkles} tone="green" detail="Authentication, reminders, and predictions" />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_11rem_10rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input className="field field-with-icon" type="search" placeholder="Search activity logs" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search system activity logs" />
          </div>
            <select className="field" value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by log type">
              <option>All log types</option>
              <option>Staff Activity</option>
              <option>System Activity</option>
            </select>
          <select className="field" value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filter by action">
              <option>All actions</option>
              {actions.map((value) => <option key={value}>{value}</option>)}
          </select>
            <select className="field" value={module} onChange={(event) => setModule(event.target.value)} aria-label="Filter by module">
              <option>All modules</option>
              {modules.map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:w-[calc(23rem+0.75rem)] xl:grid-cols-2">
            <select className="field" value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filter by staff or user">
              <option>All users</option>
              {actors.map((value) => <option key={value}>{value}</option>)}
            </select>
          <label className="relative block">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <span className="sr-only">Filter by date</span>
            <select className="field field-with-icon" value={date} onChange={(event) => setDate(event.target.value)}>
              <option>All dates</option>
              {dates.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          </div>
        </div>

        {error ? <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} /> : loading ? <SkeletonRows count={6} /> : filteredLogs.length === 0 ? (
          <EmptyState icon={ListChecks} title="No activity logs found" description="Clear a filter or adjust your search to see staff and system events." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Date and time</th><th>Staff / User</th><th>Type</th><th>Action</th><th>Module</th><th>Description</th></tr></thead>
              <tbody>{filteredLogs.map((log) => <tr key={log.id}>
                <td className="whitespace-nowrap">{log.dateTime}</td>
                <td><div><p className="font-semibold whitespace-nowrap text-[#2f3542]">{log.actor}</p><p className="mt-0.5 font-mono text-[10px] text-gray-400">LOG-{log.id}</p></div></td>
                <td><Badge tone={log.type === 'Staff Activity' ? 'rose' : 'neutral'}>{log.type}</Badge></td>
                <td><ActionBadge action={log.action} /></td>
                <td className="font-medium whitespace-nowrap text-[#2f3542]!">{log.module}</td>
                <td className="min-w-72 max-w-xl text-[#2f3542]!">{log.description}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-col gap-1 border-t border-gray-100 px-5 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {filteredLogs.length} of {activityLogs.length} recorded events</span>
          <span>Read-only monitoring view</span>
        </footer>
      </section>

      <aside className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 sm:p-5">
        <ListChecks className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <div><p className="text-sm font-bold">Activity logs are read-only</p><p className="mt-1 text-xs leading-5 text-blue-800">This view records actions for monitoring and accountability. It does not add, remove, or alter any existing module workflow.</p></div>
      </aside>
    </div>
  )
}

function ActionBadge({ action }: { action: ActivityAction }) {
  const Icon = actionIcons[action]
  return (
    <Badge tone={actionTones[action]}>
      <Icon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {action}
    </Badge>
  )
}
