import { BellRing, CalendarDays, ChartNoAxesCombined, Play, Search, TrendingDown, UserRoundCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, EmptyState, ErrorState, MetricCard, PageHeader, PilotNotice, PrototypeNotice, SkeletonRows } from '../../components/Ui'
import { runNoShowPredictions } from '../../lib/ml-api'
import { dateKey, fetchStaffPredictions } from '../../lib/staff-data'
import type { StaffPrediction } from '../../types'

export function NoShowPredictions() {
  const [predictions, setPredictions] = useState<StaffPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('All predictions')
  const [risk, setRisk] = useState('All risk levels')
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState('')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = dateKey(tomorrow)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchStaffPredictions(tomorrowKey)
      .then((rows) => { if (active) setPredictions(rows) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load predictions.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey, tomorrowKey])

  const filtered = predictions.filter((item) => `${item.patientName} ${item.serviceName}`.toLowerCase().includes(query.toLowerCase()) && (result === 'All predictions' || item.result === result) && (risk === 'All risk levels' || item.risk === risk))
  const noShows = predictions.filter((item) => item.result === 'No-Show').length
  const reminders = predictions.filter((item) => item.reminderStatus === 'Sent').length
  const usesSyntheticModel = predictions.some((item) => item.modelVersion.includes('synthetic'))
  const usesPilotModel = predictions.some((item) => item.modelVersion.includes('pilot'))
  const riskTone = (value: StaffPrediction['risk']) => value === 'High' ? 'danger' : value === 'Moderate' ? 'warning' : 'success'

  const generatePredictions = async () => {
    if (!window.confirm('Generate tomorrow’s no-show predictions for staff review? Unsupported services will be skipped, and results will not control SMS delivery.')) return
    setRunning(true)
    try {
      const run = await runNoShowPredictions()
      const skipped = run.skipped ? ` ${run.skipped} skipped (${run.skipped_services.join(', ')}).` : ''
      setToast(`${run.generated} ${run.generated === 1 ? 'prediction' : 'predictions'} generated with ${run.model_version} for ${run.appointment_date}.${skipped}`)
      setReloadKey((value) => value + 1)
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : 'Unable to generate predictions.')
    } finally {
      setRunning(false)
      window.setTimeout(() => setToast(''), 4500)
    }
  }

  return <div className="space-y-8">
    <PageHeader
      eyebrow="Decision support"
      title="No-show predictions"
      description="Review automated appointment predictions and reminder status before tomorrow’s service."
      action={<div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"><CalendarDays className="size-4 text-[#c95676]" />{tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <button className="btn btn-primary" type="button" onClick={() => void generatePredictions()} disabled={running}><Play className="size-4" aria-hidden="true" />{running ? 'Generating…' : 'Generate predictions'}</button>
      </div>}
    />
    {usesSyntheticModel && <PrototypeNotice historical={usesPilotModel} />}
    {usesPilotModel && <PilotNotice />}
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard label="Appointments reviewed" value={String(predictions.length)} icon={ChartNoAxesCombined} detail="Latest stored prediction results" />
      <MetricCard label="Predicted no-show" value={String(noShows)} icon={TrendingDown} tone="red" detail="Model result for staff review" />
      <MetricCard label="High follow-ups sent" value={String(reminders)} icon={BellRing} tone="green" detail="Standard appointment SMS remains independent" />
    </section>
    {error ? <ErrorState description={error} onRetry={() => setReloadKey((value) => value + 1)} /> : <section className="card overflow-hidden">
      <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
        <div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-[17px] -translate-y-1/2 text-gray-400" /><input className="field field-with-icon" type="search" placeholder="Search patient or service" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select className="field" value={result} onChange={(event) => setResult(event.target.value)}><option>All predictions</option><option>Show</option><option>No-Show</option></select>
        <select className="field" value={risk} onChange={(event) => setRisk(event.target.value)}><option>All risk levels</option><option>Low</option><option>Moderate</option><option>High</option></select>
      </div>
      {loading ? <SkeletonRows count={5} /> : filtered.length === 0 ? <EmptyState icon={ChartNoAxesCombined} title={predictions.length ? 'No predictions found' : 'No predictions yet'} description={predictions.length ? 'Adjust your search or prediction filters.' : 'Start FastAPI, then generate tomorrow’s staff-review predictions.'} /> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Patient</th><th>Appointment</th><th>Prediction</th><th>Probability</th><th>Risk level</th><th>Model</th><th>Predicted at</th><th>Follow-up SMS</th></tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id}>
          <td className="font-semibold whitespace-nowrap text-[#2f3542]!">{item.patientName}</td>
          <td><p className="font-medium whitespace-nowrap text-[#2f3542]">{item.appointmentDateTime}</p><p className="mt-0.5 text-xs text-gray-400">{item.serviceName}</p></td>
          <td><Badge tone={item.result === 'Show' ? 'success' : 'warning'}>{item.result}</Badge></td>
          <td><div className="flex min-w-32 items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${item.probability >= 70 ? 'bg-red-500' : item.probability >= 40 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${item.probability}%` }} /></div><span className="w-9 text-end text-xs font-semibold">{item.probability}%</span></div></td>
          <td><Badge tone={riskTone(item.risk)}>{item.risk}</Badge></td>
          <td><Badge tone={item.modelVersion.includes('synthetic') ? 'warning' : 'info'}>{item.modelVersion.includes('synthetic') ? 'Prototype' : item.modelVersion.includes('pilot') ? 'Real pilot' : item.modelVersion}</Badge></td>
          <td className="whitespace-nowrap">{item.predictedAt}</td>
          <td><Badge tone={item.reminderStatus === 'Sent' ? 'success' : item.reminderStatus === 'Failed' ? 'danger' : 'neutral'}>{item.reminderStatus}</Badge></td>
        </tr>)}</tbody>
      </table></div>}
    </section>}
    <aside className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 sm:p-5"><UserRoundCheck className="mt-0.5 size-[18px]" /><div><p className="text-sm font-bold">Predictions support staff decisions</p><p className="mt-1 text-xs leading-5 text-blue-800">The system displays automated results and reminder status. Staff cannot manually alter prediction outcomes from this page.</p></div></aside>
    {toast && <div className="fixed end-4 bottom-4 z-[80] max-w-sm rounded-xl bg-[#263238] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status">{toast}</div>}
  </div>
}
