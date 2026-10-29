import { BellRing, CalendarClock, Check, Clock3, Pencil, Plus, Search, XCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth-context'
import { Badge, EmptyState, ErrorState, Modal, PageHeader, SkeletonRows } from '../../components/Ui'
import { formatTime } from '../../formatters'
import { cancelAppointment, createAppointment, dateKey, fetchAppointments, fetchHealthServices, fetchPatients, rescheduleAppointment, runAppointmentReminders, type AppointmentInput, type ReminderType } from '../../lib/staff-data'
import type { Appointment, AppointmentStatus, HealthService, Patient, ReminderStatus } from '../../types'

const emptyForm = (): AppointmentInput => ({ patientId: '', serviceId: '', date: dateKey(), time: '08:00', remarks: '' })

export function AppointmentSchedules() {
  const { session } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [services, setServices] = useState<HealthService[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | AppointmentStatus>('All')
  const [mode, setMode] = useState<'create' | 'reschedule' | 'cancel' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<AppointmentInput>(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reminderRunning, setReminderRunning] = useState<ReminderType | null>(null)
  const [toast, setToast] = useState('')
  const selected = appointments.find((item) => item.id === selectedId)
  const filtered = appointments.filter((item) => `${item.appointmentCode} ${item.patientName} ${item.serviceName}`.toLowerCase().includes(query.toLowerCase()) && (status === 'All' || item.status === status))

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    Promise.all([fetchAppointments(), fetchPatients(), fetchHealthServices()]).then(([nextAppointments, nextPatients, nextServices]) => {
      if (active) { setAppointments(nextAppointments); setPatients(nextPatients); setServices(nextServices) }
    }).catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Unable to load appointments.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const openCreate = () => { setForm(emptyForm()); setError(''); setSelectedId(null); setMode('create') }
  const openReschedule = (item: Appointment) => { setSelectedId(item.id); setForm({ patientId: item.patientId, serviceId: item.serviceId, date: item.date, time: item.time, remarks: item.remarks }); setError(''); setMode('reschedule') }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.patientId || !form.serviceId || !form.date || !form.time) { setError('Select a patient, service, date, and time.'); return }
    if (form.date < dateKey()) { setError('Appointments cannot be scheduled before today.'); return }
    if (form.time < '06:40' || form.time > '17:00') { setError('Choose a time within health center hours, 6:40 AM to 5:00 PM.'); return }
    if (!session) return
    setSaving(true); setError('')
    try {
      if (mode === 'create') {
        const appointment = await createAppointment(form, session.userId)
        setAppointments((current) => [appointment, ...current]); notify('Appointment created successfully.')
      } else if (selectedId) {
        const appointment = await rescheduleAppointment(selectedId, form)
        setAppointments((current) => current.map((item) => item.id === selectedId ? appointment : item)); notify('Appointment rescheduled.')
      }
      setMode(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the appointment.') } finally { setSaving(false) }
  }

  const confirmCancel = async () => {
    if (!selectedId) return
    setSaving(true); setError('')
    try { await cancelAppointment(selectedId); setAppointments((current) => current.map((item) => item.id === selectedId ? { ...item, status: 'Cancelled' } : item)); setMode(null); notify('Appointment marked as cancelled.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to cancel the appointment.') }
    finally { setSaving(false) }
  }
  const tone = (value: AppointmentStatus) => value === 'Completed' ? 'success' : value === 'Cancelled' ? 'danger' : 'rose'
  const reminderTone = (value: ReminderStatus) => value === 'Sent' ? 'success' : value === 'Queued' ? 'warning' : value === 'Failed' ? 'danger' : 'neutral'
  const runReminders = async (reminderType: ReminderType) => {
    const followUp = reminderType === 'high_risk_follow_up'
    const confirmation = followUp
      ? 'Send an additional SMS now to tomorrow’s High-risk real-pilot appointments? Generate today’s predictions first. Real PhilSMS mode uses SMS credits.'
      : 'Send standard reminders for tomorrow now? Every eligible consenting appointment is included. Real PhilSMS mode uses SMS credits.'
    if (!window.confirm(confirmation)) return
    setReminderRunning(reminderType)
    try {
      const result = await runAppointmentReminders(reminderType)
      setAppointments(await fetchAppointments())
      const skipReasons = result.skipReasons
      const skipReason = skipReasons?.noConsent ? ' Patient consent is off.'
        : skipReasons?.noPrediction ? ' Generate today’s predictions first.'
          : skipReasons?.modelMismatch ? ' Only the active real-pilot model qualifies.'
            : skipReasons?.stalePrediction ? ' Regenerate predictions after schedule changes.'
              : skipReasons?.notHighRisk ? ' Non-High predictions were excluded.'
                : skipReasons?.alreadySent ? ' This reminder type was already sent.'
                  : skipReasons?.retryLimit ? ' Retry limit reached.'
                    : skipReasons?.activeAttempt ? ' Another attempt is still active.'
                      : skipReasons?.concurrentRun ? ' Another reminder run handled it.' : ''
      const label = result.reminderType === 'standard' ? 'standard reminders' : 'High-risk follow-ups'
      notify(`${result.provider === 'philsms' ? 'PhilSMS' : 'Mock'} ${label} for ${result.appointmentDate}: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed.${skipReason}${result.failureReason ? ` ${result.failureReason}` : ''}`)
    } catch (reason) { notify(reason instanceof Error ? reason.message : 'Unable to run reminders.') }
    finally { setReminderRunning(null) }
  }

  return <div className="space-y-8">
    <PageHeader eyebrow="Scheduling" title="Appointment schedules" description="Create, reschedule, cancel, and review standard and High-risk follow-up reminders." action={<div className="flex flex-col gap-2 sm:flex-row"><button className="btn btn-secondary" type="button" onClick={() => void runReminders('standard')} disabled={reminderRunning !== null}><BellRing className="size-4" />{reminderRunning === 'standard' ? 'Sending…' : 'Send standard SMS'}</button><button className="btn btn-secondary" type="button" onClick={() => void runReminders('high_risk_follow_up')} disabled={reminderRunning !== null}><BellRing className="size-4" />{reminderRunning === 'high_risk_follow_up' ? 'Sending…' : 'Send High-risk follow-up'}</button><button className="btn btn-primary" type="button" onClick={openCreate}><Plus className="size-4" />Create appointment</button></div>} />
    {loadError ? <ErrorState description={loadError} onRetry={() => setReloadKey((value) => value + 1)} /> : <section className="card overflow-hidden">
      <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[minmax(14rem,1fr)_11rem] sm:p-5"><div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-[17px] -translate-y-1/2 text-gray-400" /><input className="field field-with-icon" type="search" placeholder="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="field" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option>All</option><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></div>
      {loading ? <SkeletonRows count={6} /> : filtered.length === 0 ? <EmptyState icon={CalendarClock} title="No appointments found" description="Adjust the search or status filter to see schedules." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Appointment</th><th>Patient</th><th>Service</th><th>Date and time</th><th>Status</th><th>Standard SMS</th><th>Follow-up SMS</th><th>Remarks</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td className="font-mono text-xs">{item.appointmentCode}</td><td className="font-semibold whitespace-nowrap text-[#2f3542]!">{item.patientName}</td><td>{item.serviceName}</td><td className="whitespace-nowrap"><p className="font-medium text-[#2f3542]">{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400"><Clock3 className="size-3" />{formatTime(item.time)}</p></td><td><Badge tone={tone(item.status)}>{item.status}</Badge></td><td><Badge tone={reminderTone(item.standardReminderStatus)}>{item.standardReminderStatus}</Badge></td><td><Badge tone={reminderTone(item.followUpReminderStatus)}>{item.followUpReminderStatus}</Badge></td><td className="max-w-52">{item.remarks || '—'}</td><td><div className="flex justify-end gap-1">{item.status === 'Scheduled' && <><button className="btn btn-ghost min-h-9 px-2" type="button" onClick={() => openReschedule(item)}><Pencil className="size-[15px]" />Reschedule</button><button className="btn btn-ghost min-h-9 px-2 text-red-700 hover:bg-red-50 hover:text-red-800" type="button" onClick={() => { setSelectedId(item.id); setError(''); setMode('cancel') }}><XCircle className="size-[15px]" />Cancel</button></>}</div></td></tr>)}</tbody></table></div>}
      <footer className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500">Showing {filtered.length} appointments</footer>
    </section>}

    {(mode === 'create' || mode === 'reschedule') && <Modal title={mode === 'create' ? 'Create appointment' : 'Reschedule appointment'} description="Choose an existing patient and an available health center service." onClose={() => setMode(null)}><form onSubmit={submit}><div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6"><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-gray-700">Patient</span><select className="field" value={form.patientId} onChange={(event) => setForm({ ...form, patientId: event.target.value })}><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} · {patient.patientCode}</option>)}</select></label><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-gray-700">Service</span><select className="field" value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })}><option value="">Select service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration} min</option>)}</select></label><label><span className="mb-2 block text-xs font-semibold text-gray-700">Date</span><input className="field" type="date" min={dateKey()} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label><span className="mb-2 block text-xs font-semibold text-gray-700">Time</span><input className="field" type="time" min="06:40" max="17:00" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label><label className="sm:col-span-2"><span className="mb-2 block text-xs font-semibold text-gray-700">Remarks <span className="font-normal text-gray-400">(optional)</span></span><input className="field" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></label>{error && <p className="text-xs font-semibold text-red-700 sm:col-span-2">{error}</p>}</div><footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setMode(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : mode === 'create' ? 'Create appointment' : 'Save schedule'}</button></footer></form></Modal>}
    {mode === 'cancel' && selected && <Modal title="Cancel appointment" description="The appointment remains in its history with a Cancelled status." onClose={() => setMode(null)}><div className="px-5 py-6 sm:px-6"><div className="rounded-xl bg-red-50 p-4"><p className="text-sm font-bold text-red-900">{selected.patientName}</p><p className="mt-1 text-xs leading-5 text-red-700">{selected.serviceName} · {selected.date} at {formatTime(selected.time)}</p></div>{error && <p className="mt-3 text-xs font-semibold text-red-700">{error}</p>}</div><footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setMode(null)} disabled={saving}>Keep appointment</button><button className="btn bg-red-600 text-white hover:bg-red-700" type="button" onClick={confirmCancel} disabled={saving}>{saving ? 'Cancelling…' : 'Confirm cancellation'}</button></footer></Modal>}
    {toast && <div className="fixed end-4 bottom-4 z-[80] flex items-center gap-2 rounded-xl bg-[#2f3542] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status"><Check className="size-4 text-emerald-300" />{toast}</div>}
  </div>
}
