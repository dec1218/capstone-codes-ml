import { FileBarChart, Play } from 'lucide-react'
import { useState } from 'react'
import { AttendanceBars, QueueLine } from '../../components/Charts'
import { Badge, EmptyState, PageHeader, SectionHeader, SkeletonRows } from '../../components/Ui'
import { dateKey, fetchStaffReport, type StaffReportData } from '../../lib/staff-data'
import type { Appointment, AttendanceRecord, QueueRecord } from '../../types'

type ReportType = 'attendance' | 'appointments' | 'queue'
const today = new Date()
const weekAgo = new Date(today)
weekAgo.setDate(today.getDate() - 6)

export function StaffReports() {
  const [report, setReport] = useState<ReportType>('attendance')
  const [from, setFrom] = useState(dateKey(weekAgo))
  const [to, setTo] = useState(dateKey(today))
  const [data, setData] = useState<StaffReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedAt, setGeneratedAt] = useState('Select filters and generate a preview')

  const generate = async () => {
    if (from > to) { setError('The start date must be before or equal to the end date.'); return }
    setError(''); setLoading(true)
    try {
      setData(await fetchStaffReport(from, to))
      setGeneratedAt(`Generated ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate the report.') }
    finally { setLoading(false) }
  }

  return <div className="space-y-8">
    <PageHeader eyebrow="Operational reporting" title="Staff reports" description="Generate read-only previews for attendance, appointments, and queue performance." />
    <section className="card p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end"><label><span className="mb-2 block text-xs font-semibold text-gray-700">Report type</span><select className="field" value={report} onChange={(event) => setReport(event.target.value as ReportType)}><option value="attendance">Attendance report</option><option value="appointments">Appointment report</option><option value="queue">Queue performance report</option></select></label><label><span className="mb-2 block text-xs font-semibold text-gray-700">From</span><input className="field" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setError('') }} /></label><label><span className="mb-2 block text-xs font-semibold text-gray-700">To</span><input className="field" type="date" value={to} onChange={(event) => { setTo(event.target.value); setError('') }} /></label><button className="btn btn-primary" type="button" onClick={() => void generate()} disabled={loading}><Play className="size-4" aria-hidden="true" />{loading ? 'Generating…' : 'Generate preview'}</button></div>{error && <p className="mt-3 text-xs font-semibold text-red-700" role="alert">{error}</p>}</section>
    {loading ? <div className="card" aria-busy="true"><SkeletonRows count={6} /></div> : <section className="card overflow-hidden"><SectionHeader title={report === 'attendance' ? 'Attendance report preview' : report === 'appointments' ? 'Appointment report preview' : 'Queue performance report preview'} description={`${formatDate(from)} to ${formatDate(to)}`} action={<span className="text-xs text-gray-500">{generatedAt}</span>} />{!data ? <EmptyState icon={FileBarChart} title="No report generated" description="Choose a report type and date range, then generate a live preview." /> : report === 'attendance' ? <AttendanceReport data={data.attendance} /> : report === 'appointments' ? <AppointmentReport data={data.appointments} /> : <QueueReport data={data.queue} />}</section>}
    <aside className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5"><FileBarChart className="mt-0.5 size-[18px] text-[#c95676]" aria-hidden="true" /><div><p className="text-sm font-bold text-[#2f3542]">Report coverage</p><p className="mt-1 text-xs leading-5 text-gray-500">Reports contain only attendance, appointment, and queue-performance information within the selected date range.</p></div></aside>
  </div>
}

function AttendanceReport({ data }: { data: AttendanceRecord[] }) {
  if (!data.some((item) => item.present || item.late || item.noShow)) return <EmptyState icon={FileBarChart} title="No attendance data" description="No attendance records fall within this date range." />
  return <><AttendanceBars data={data} /><div className="table-scroll mt-6 border-t border-gray-100" role="region" aria-label="Attendance report table" tabIndex={0}><table className="data-table"><caption className="sr-only">Attendance report by service date</caption><thead><tr><th>Date</th><th>Present</th><th>Late</th><th>No-show</th><th>Total</th></tr></thead><tbody>{data.map((item) => <tr key={item.date}><td className="font-semibold text-[#2f3542]!">{item.date}</td><td>{item.present}</td><td>{item.late}</td><td>{item.noShow}</td><td>{item.present + item.late + item.noShow}</td></tr>)}</tbody></table></div></>
}
function AppointmentReport({ data }: { data: Appointment[] }) {
  if (!data.length) return <EmptyState icon={FileBarChart} title="No appointment data" description="No appointments fall within this date range." />
  return <div className="table-scroll" role="region" aria-label="Appointment report table" tabIndex={0}><table className="data-table"><caption className="sr-only">Appointments within the selected report period</caption><thead><tr><th>Appointment</th><th>Patient</th><th>Service</th><th>Date and time</th><th>Status</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td className="font-mono text-xs">{item.appointmentCode}</td><td className="font-semibold text-[#2f3542]!">{item.patientName}</td><td>{item.serviceName}</td><td>{formatDate(item.date)} · {item.time}</td><td><Badge tone={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'danger' : 'rose'}>{item.status}</Badge></td></tr>)}</tbody></table></div>
}
function QueueReport({ data }: { data: QueueRecord[] }) {
  if (!data.some((item) => item.completed || item.waitingMinutes)) return <EmptyState icon={FileBarChart} title="No queue data" description="No queue-performance records fall within this date range." />
  return <><QueueLine data={data} /><div className="table-scroll mt-4 border-t border-gray-100" role="region" aria-label="Queue performance report table" tabIndex={0}><table className="data-table"><caption className="sr-only">Queue performance by service day</caption><thead><tr><th>Service day</th><th>Completed visits</th><th>Average waiting time</th><th>Performance</th></tr></thead><tbody>{data.map((item) => <tr key={item.day}><td className="font-semibold text-[#2f3542]!">{item.day}</td><td>{item.completed}</td><td>{item.waitingMinutes} minutes</td><td><Badge tone={item.waitingMinutes <= 20 ? 'success' : 'warning'}>{item.waitingMinutes <= 20 ? 'Within average' : 'Above average'}</Badge></td></tr>)}</tbody></table></div></>
}
function formatDate(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
