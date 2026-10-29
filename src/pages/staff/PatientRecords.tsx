import { Check, Eye, Pencil, Plus, Search, UserRoundSearch } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth-context'
import { Badge, EmptyState, ErrorState, Modal, PageHeader, SkeletonRows } from '../../components/Ui'
import { createPatient, fetchPatientHistory, fetchPatients, updatePatient, type PatientHistoryEntry, type PatientInput } from '../../lib/staff-data'
import type { Patient } from '../../types'

type PatientMode = 'create' | 'view' | 'edit'
const emptyPatient: PatientInput = { firstName: '', lastName: '', age: 0, gender: 'Female', contactNumber: '', smsConsent: false, address: '' }

export function PatientRecords() {
  const { session } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<PatientMode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<PatientHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [form, setForm] = useState<PatientInput>(emptyPatient)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const selected = patients.find((patient) => patient.id === selectedId)
  const filtered = patients.filter((patient) => `${patient.patientCode} ${patient.firstName} ${patient.lastName} ${patient.contactNumber}`.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    fetchPatients().then((result) => { if (active) setPatients(result) }).catch((reason) => { if (active) setLoadError(reason instanceof Error ? reason.message : 'Unable to load patients.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const openPatient = (patient: Patient, nextMode: PatientMode) => {
    setSelectedId(patient.id)
    setForm({ firstName: patient.firstName, lastName: patient.lastName, age: patient.age, gender: patient.gender, contactNumber: patient.contactNumber, smsConsent: patient.smsConsent, address: patient.address })
    setError(''); setMode(nextMode)
    if (nextMode === 'view') {
      setHistory([]); setHistoryLoading(true)
      fetchPatientHistory(patient.id).then(setHistory).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load service history.')).finally(() => setHistoryLoading(false))
    }
  }
  const openCreate = () => { setSelectedId(null); setForm(emptyPatient); setError(''); setMode('create') }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || form.age < 1 || !form.address.trim()) { setError('Complete all required patient information.'); return }
    if (!/^09\d{9}$/.test(form.contactNumber.replace(/\s/g, ''))) { setError('Enter a valid 11-digit Philippine mobile number.'); return }
    if (!session) return
    setSaving(true); setError('')
    try {
      if (mode === 'create') {
        const patient = await createPatient(form, session.userId)
        setPatients((current) => [patient, ...current]); notify('Patient record registered successfully.')
      } else if (mode === 'edit' && selectedId) {
        const patient = await updatePatient(selectedId, form)
        setPatients((current) => current.map((item) => item.id === selectedId ? patient : item)); notify('Patient information updated.')
      }
      setMode(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the patient record.') } finally { setSaving(false) }
  }

  return <div className="space-y-8">
    <PageHeader eyebrow="Patient management" title="Patient records" description="Register patients and maintain demographic information used by appointments and queue services." action={<button className="btn btn-primary" type="button" onClick={openCreate}><Plus className="size-4" />Register patient</button>} />
    {loadError ? <ErrorState description={loadError} onRetry={() => setReloadKey((value) => value + 1)} /> : <section className="card overflow-hidden">
      <div className="border-b border-gray-100 p-4 sm:p-5"><div className="relative max-w-md"><Search className="pointer-events-none absolute start-3 top-1/2 size-[17px] -translate-y-1/2 text-gray-400" /><input className="field field-with-icon" type="search" placeholder="Search by patient, ID, or contact" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search patients" /></div></div>
      {loading ? <SkeletonRows count={6} /> : filtered.length === 0 ? <EmptyState icon={UserRoundSearch} title="No patients found" description="Try another name, patient ID, or contact number." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Patient</th><th>Age</th><th>Gender</th><th>Contact</th><th>Address</th><th>Registered</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((patient) => <tr key={patient.id}><td><p className="font-semibold whitespace-nowrap text-[#2f3542]">{patient.firstName} {patient.lastName}</p><p className="mt-0.5 text-xs text-gray-400">{patient.patientCode}</p></td><td>{patient.age}</td><td>{patient.gender}</td><td className="whitespace-nowrap">{patient.contactNumber}</td><td className="max-w-56">{patient.address}</td><td className="whitespace-nowrap">{patient.registeredAt}</td><td><div className="flex justify-end gap-1"><button className="btn btn-ghost min-h-9 px-2.5" type="button" onClick={() => openPatient(patient, 'view')}><Eye className="size-[15px]" />View</button><button className="btn btn-ghost min-h-9 px-2.5" type="button" onClick={() => openPatient(patient, 'edit')}><Pencil className="size-[15px]" />Edit</button></div></td></tr>)}</tbody></table></div>}
      <footer className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500">Showing {filtered.length} of {patients.length} patient records</footer>
    </section>}

    {mode === 'view' && selected && <Modal title={`${selected.firstName} ${selected.lastName}`} description={`${selected.patientCode} · Registered ${selected.registeredAt}`} onClose={() => setMode(null)}><div className="px-5 py-6 sm:px-6"><div className="grid gap-4 sm:grid-cols-2">{[['Age', selected.age], ['Gender', selected.gender], ['Contact number', selected.contactNumber], ['SMS reminders', selected.smsConsent ? 'Consented' : 'Not consented'], ['Address', selected.address]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-gray-50 p-4"><p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase">{label}</p><p className="mt-1.5 text-sm font-semibold text-[#2f3542]">{value}</p></div>)}</div><div className="mt-5 border-t border-gray-100 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#2f3542]">Service history</h3><p className="mt-1 text-xs text-gray-500">Appointments and attendance only</p></div><Badge tone="neutral">{history.length} {history.length === 1 ? 'visit' : 'visits'}</Badge></div>{historyLoading ? <SkeletonRows count={3} /> : error ? <p className="mt-4 text-xs font-semibold text-red-700">{error}</p> : history.length ? <div className="mt-4 space-y-2">{history.map((item) => <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-xs text-gray-600"><div className="flex items-start justify-between gap-3"><strong className="text-[#2f3542]">{item.serviceName}</strong><Badge tone={item.status === 'No-Show' || item.status === 'Cancelled' ? 'danger' : item.status === 'Late' ? 'warning' : 'success'}>{item.status}</Badge></div><p className="mt-1">{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {item.appointmentCode}</p></div>)}</div> : <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-500">No appointment or attendance history yet.</div>}</div></div><footer className="flex justify-end border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setMode(null)}>Close</button></footer></Modal>}

    {(mode === 'create' || mode === 'edit') && <Modal title={mode === 'create' ? 'Register patient' : 'Update patient information'} description="Patient records contain demographics and service history, not clinical diagnoses." onClose={() => setMode(null)}><form onSubmit={submit}><div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6"><Field label="First name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} /><Field label="Last name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} /><Field label="Age" type="number" value={String(form.age || '')} onChange={(value) => setForm({ ...form, age: Number(value) })} /><label><span className="mb-2 block text-xs font-semibold text-gray-700">Gender</span><select className="field" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Patient['gender'] })}><option>Female</option><option>Male</option></select></label><Field label="Contact number" value={form.contactNumber} onChange={(value) => setForm({ ...form, contactNumber: value })} placeholder="09XXXXXXXXX" /><div className="sm:col-span-2"><Field label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /></div><label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2"><input className="mt-0.5 size-4 accent-[#c75572]" type="checkbox" checked={form.smsConsent} onChange={(event) => setForm({ ...form, smsConsent: event.target.checked })} /><span><span className="block text-xs font-semibold text-gray-700">Send SMS appointment reminders</span><span className="mt-1 block text-xs leading-5 text-gray-500">Check only after the patient agrees to receive appointment messages. Uncheck this to opt out.</span></span></label>{error && <p className="text-xs font-semibold text-red-700 sm:col-span-2">{error}</p>}</div><footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6"><button className="btn btn-secondary" type="button" onClick={() => setMode(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : mode === 'create' ? 'Register patient' : 'Save changes'}</button></footer></form></Modal>}
    {toast && <div className="fixed end-4 bottom-4 z-[80] flex items-center gap-2 rounded-xl bg-[#2f3542] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status"><Check className="size-4 text-emerald-300" />{toast}</div>}
  </div>
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label><span className="mb-2 block text-xs font-semibold text-gray-700">{label}</span><input className="field" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}
