import { Check, ClipboardCheck, Clock3, Plus, Search, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth-context'
import { Badge, EmptyState, ErrorState, MetricCard, Modal, PageHeader, SkeletonRows } from '../../components/Ui'
import { formatTime } from '../../formatters'
import { dateKey, fetchAppointments, fetchTodayAttendance, markAttendance } from '../../lib/staff-data'
import type { Appointment, AttendanceEntry, AttendanceStatus } from '../../types'

export function Attendance() {
  const { session } = useAuth()
  const [records, setRecords] = useState<AttendanceEntry[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | AttendanceStatus>('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentId, setAppointmentId] = useState('')
  const [status, setStatus] = useState<AttendanceStatus>('Present')
  const [checkIn, setCheckIn] = useState('09:00')
  const [checkOut, setCheckOut] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const filtered = records.filter((record) => `${record.patientName} ${record.appointmentCode} ${record.serviceName}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || record.status === filter))
  const count = (value: AttendanceStatus) => records.filter((record) => record.status === value).length

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    Promise.all([fetchTodayAttendance(), fetchAppointments(dateKey(), dateKey())]).then(([nextRecords, nextAppointments]) => {
      if (active) { setRecords(nextRecords); setAppointments(nextAppointments.filter((item) => item.status !== 'Cancelled')) }
    }).catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Unable to load attendance.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400) }
  const openAttendance = () => { setAppointmentId(''); setStatus('Present'); setCheckIn('09:00'); setCheckOut(''); setModalOpen(true) }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!appointmentId || !session) return
    if (status !== 'No-Show' && !checkIn) { notify('Enter a check-in time for attended appointments.'); return }
    if (status !== 'No-Show' && checkOut && checkOut < checkIn) { notify('Check-out time cannot be earlier than check-in time.'); return }
    setSaving(true)
    try { await markAttendance({ appointmentId, status, checkIn, checkOut }, session.userId); setRecords(await fetchTodayAttendance()); setModalOpen(false); notify('Attendance record saved.') }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Unable to save attendance.') }
    finally { setSaving(false) }
  }
  const tone = (value: AttendanceStatus) => value === 'Present' ? 'success' : value === 'Late' ? 'warning' : 'danger'

  return <div className="space-y-8">
    <PageHeader eyebrow="Daily attendance" title="Attendance" description="Record appointment attendance and review check-in and check-out times." action={<button className="btn btn-primary" type="button" onClick={openAttendance}><Plus className="size-4" />Record attendance</button>} />
    <section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Present" value={String(count('Present'))} icon={UserRoundCheck} tone="green" detail="Arrived within scheduled time" /><MetricCard label="Late" value={String(count('Late'))} icon={Clock3} tone="amber" detail="Arrived after scheduled time" /><MetricCard label="No-show" value={String(count('No-Show'))} icon={UserRoundX} tone="red" detail="Did not attend appointment" /></section>
    {loadError ? <ErrorState description={loadError} onRetry={() => setReloadKey((value) => value + 1)} /> : <section className="card overflow-hidden"><div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[minmax(14rem,1fr)_11rem] sm:p-5"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-[17px] -translate-y-1/2 text-gray-400" /><input className="field field-with-icon" type="search" placeholder="Search attendance" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="field" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option>All</option><option>Present</option><option>Late</option><option>No-Show</option></select></div>{loading ? <SkeletonRows count={5} /> : filtered.length === 0 ? <EmptyState icon={ClipboardCheck} title="No attendance records found" description="Adjust your filters or record attendance for an appointment." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Patient</th><th>Appointment</th><th>Service</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td className="font-semibold whitespace-nowrap text-[#2f3542]!">{record.patientName}</td><td><p className="font-mono text-xs">{record.appointmentCode}</p><p className="mt-1 text-xs text-gray-400">{formatTime(record.appointmentTime)}</p></td><td>{record.serviceName}</td><td><Badge tone={tone(record.status)}>{record.status}</Badge></td><td>{record.checkIn}</td><td>{record.checkOut}</td></tr>)}</tbody></table></div>}<footer className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {filtered.length} records shown</footer></section>}
    {modalOpen && <Modal title="Record attendance" description="Choose an appointment and record its attendance outcome." onClose={() => setModalOpen(false)}><form onSubmit={submit}><div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6"><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-gray-700">Appointment</span><select className="field" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} required><option value="">Select appointment</option>{appointments.map((item) => <option key={item.id} value={item.id}>{item.patientName} · {formatTime(item.time)} · {item.serviceName}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-gray-700">Attendance status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}><option>Present</option><option>Late</option><option>No-Show</option></select></label>{status !== 'No-Show' && <><label><span className="mb-2 block text-xs font-semibold text-gray-700">Check-in time</span><input className="field" type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label><label><span className="mb-2 block text-xs font-semibold text-gray-700">Check-out time <span className="font-normal text-gray-400">(optional)</span></span><input className="field" type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></label></>}</div><footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={!appointmentId || saving}>{saving ? 'Saving…' : 'Save attendance'}</button></footer></form></Modal>}
    {toast && <div className="fixed end-4 bottom-4 z-[80] flex max-w-sm items-center gap-2 rounded-xl bg-[#2f3542] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status"><Check className="size-4 text-emerald-300" />{toast}</div>}
  </div>
}
