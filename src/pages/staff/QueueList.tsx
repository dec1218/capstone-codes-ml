import { Check, Clock3, ListOrdered, Plus, Radio, UsersRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth-context'
import { Badge, EmptyState, ErrorState, MetricCard, Modal, PageHeader, SkeletonRows } from '../../components/Ui'
import { formatTime } from '../../formatters'
import { assignQueueNumber, fetchQueueAppointments, fetchTodayQueue, updateQueueStatus } from '../../lib/staff-data'
import { supabase } from '../../lib/supabase'
import type { Appointment, QueueEntry, QueueStatus } from '../../types'

export function QueueList() {
  const { session } = useAuth()
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [appointmentId, setAppointmentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    const load = async (showLoading = true) => {
      if (showLoading) setLoading(true)
      try { const [nextQueue, nextAppointments] = await Promise.all([fetchTodayQueue(), fetchQueueAppointments()]); if (active) { setQueue(nextQueue); setAppointments(nextAppointments); setLoadError('') } }
      catch (reason) { if (active) setLoadError(reason instanceof Error ? reason.message : 'Unable to load the queue.') }
      finally { if (active && showLoading) setLoading(false) }
    }
    void load()
    const channel = supabase.channel('staff-today-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => { void load(false) }).subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [reloadKey])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400) }
  const updateStatus = async (entry: QueueEntry, status: QueueStatus) => {
    if (entry.status === 'Completed' && status !== 'Completed') { notify('Completed queue entries cannot be moved back to an active status.'); return }
    if (entry.status === 'Serving' && status === 'Waiting') { notify('A serving patient can only move forward to Completed.'); return }
    try { await updateQueueStatus(entry.id, status); const nextQueue = await fetchTodayQueue(); setQueue(nextQueue); notify(`Queue status updated to ${status}.`) }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Unable to update the queue.') }
  }
  const assign = async (event: FormEvent) => {
    event.preventDefault()
    if (!appointmentId || !session) return
    setSaving(true)
    try { await assignQueueNumber(appointmentId, session.userId); const [nextQueue, nextAppointments] = await Promise.all([fetchTodayQueue(), fetchQueueAppointments()]); setQueue(nextQueue); setAppointments(nextAppointments); setModalOpen(false); setAppointmentId(''); notify('Queue number assigned.') }
    catch (reason) { notify(reason instanceof Error ? reason.message : 'Unable to assign a queue number.') }
    finally { setSaving(false) }
  }
  const count = (status: QueueStatus) => queue.filter((item) => item.status === status).length
  const tone = (value: QueueStatus) => value === 'Completed' ? 'success' : value === 'Serving' ? 'info' : 'warning'
  const nextNumber = queue.length ? Math.max(...queue.map((item) => item.queueNumber)) + 1 : 1

  return <div className="space-y-8">
    <PageHeader eyebrow="Patient flow" title="Today’s queue" description="Assign queue numbers and keep each patient’s current service status visible." action={<button className="btn btn-primary" type="button" onClick={() => setModalOpen(true)}><Plus className="size-4" />Assign queue number</button>} />
    <section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Waiting" value={String(count('Waiting'))} icon={UsersRound} tone="amber" detail="Patients ready for service" /><MetricCard label="Serving" value={String(count('Serving'))} icon={Radio} tone="blue" detail="Current active queue entry" /><MetricCard label="Completed" value={String(count('Completed'))} icon={Check} tone="green" detail="Finished visits today" /></section>
    {loadError ? <ErrorState description={loadError} onRetry={() => setReloadKey((value) => value + 1)} /> : <section className="card overflow-hidden">{loading ? <SkeletonRows count={5} /> : queue.length === 0 ? <EmptyState icon={ListOrdered} title="The queue is empty" description="Assign a queue number when the first patient arrives." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Queue no.</th><th>Patient</th><th>Appointment</th><th>Service</th><th>Status</th><th>Update status</th></tr></thead><tbody>{queue.map((item) => <tr key={item.id} className={item.status === 'Serving' ? 'bg-rose-50/40' : ''}><td><span className={`grid h-11 w-11 place-items-center rounded-xl text-sm font-bold ${item.status === 'Serving' ? 'bg-[#c95676] text-white' : 'bg-gray-100 text-[#2f3542]'}`}>{item.queueNumber}</span></td><td className="font-semibold whitespace-nowrap text-[#2f3542]!">{item.patientName}</td><td><p className="font-mono text-xs">{item.appointmentCode}</p><p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Clock3 className="size-3" />{formatTime(item.appointmentTime)}</p></td><td>{item.serviceName}</td><td><Badge tone={tone(item.status)}>{item.status}</Badge></td><td><select className="field min-w-32" value={item.status} onChange={(event) => void updateStatus(item, event.target.value as QueueStatus)} aria-label={`Update queue status for ${item.patientName}`}><option>Waiting</option><option>Serving</option><option>Completed</option></select></td></tr>)}</tbody></table></div>}<footer className="flex justify-between border-t border-gray-100 px-5 py-4 text-xs text-gray-500"><span>{queue.length} queue entries today</span><span>Realtime enabled</span></footer></section>}
    {modalOpen && <Modal title="Assign queue number" description="Link an eligible appointment to the next queue number." onClose={() => setModalOpen(false)}><form onSubmit={assign}><div className="px-5 py-6 sm:px-6"><label><span className="mb-2 block text-xs font-semibold text-gray-700">Scheduled appointment</span><select className="field" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} required><option value="">Select appointment</option>{appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{appointment.patientName} · {appointment.serviceName} · {formatTime(appointment.time)}</option>)}</select></label>{appointments.length === 0 && <p className="mt-3 text-xs text-gray-500">All scheduled appointments are already queued, or none are scheduled today.</p>}</div><footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={!appointmentId || saving}>{saving ? 'Assigning…' : `Assign number ${nextNumber}`}</button></footer></form></Modal>}
    {toast && <div className="fixed end-4 bottom-4 z-[80] flex max-w-sm items-center gap-2 rounded-xl bg-[#2f3542] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status"><Check className="size-4 text-emerald-300" />{toast}</div>}
  </div>
}
