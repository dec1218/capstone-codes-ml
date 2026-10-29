import { supabase } from './supabase'
import type { ActivityLog, AttendanceRecord, PredictionRecord, QueueRecord, StaffAccount } from '../types'

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shortDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const relation = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

export interface AdminOverview {
  attendance: AttendanceRecord[]
  queue: QueueRecord[]
  activities: ActivityLog[]
  attendedToday: number
  queueCompletedToday: number
  activeQueueToday: number
  averageWaitToday: number
  tomorrowAppointments: number
  predictedAppointments: number
  predictedNoShows: number
  staffTotal: number
  staffActive: number
  usesSyntheticPredictions: boolean
  usesPilotPredictions: boolean
}

export async function fetchAdminOverview(days = 7): Promise<AdminOverview> {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - days + 1)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const startKey = dateKey(start)
  const todayKey = dateKey(today)
  const tomorrowKey = dateKey(tomorrow)

  const [attendanceResult, queueResult, activityResult, predictionResult, appointmentResult, staffResult] = await Promise.all([
    supabase.from('attendance').select('status, appointments!inner(appointment_date)').gte('appointments.appointment_date', startKey).lte('appointments.appointment_date', todayKey),
    supabase.from('queue_entries').select('queue_date, status, created_at, called_at').gte('queue_date', startKey).lte('queue_date', todayKey),
    supabase.from('activity_logs').select('id, activity_type, actor_name, action, module, description, created_at').order('created_at', { ascending: false }).limit(12),
    supabase.from('predictions').select('result, model_version, appointments!inner(appointment_date, status)').eq('appointments.appointment_date', tomorrowKey).eq('appointments.status', 'Scheduled'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', tomorrowKey).eq('status', 'Scheduled'),
    supabase.from('profiles').select('status').eq('role', 'staff'),
  ])

  const firstError = [attendanceResult.error, queueResult.error, activityResult.error, predictionResult.error, appointmentResult.error, staffResult.error].find(Boolean)
  if (firstError) throw firstError

  const attendanceRows = (attendanceResult.data ?? []) as unknown as { status: 'Present' | 'Late' | 'No-Show'; appointments: { appointment_date: string } | { appointment_date: string }[] }[]
  const queueRows = (queueResult.data ?? []) as { queue_date: string; status: string; created_at: string; called_at: string | null }[]
  const predictionRows = (predictionResult.data ?? []) as unknown as { result: 'Show' | 'No-Show'; model_version: string; appointments: { appointment_date: string; status: string } | { appointment_date: string; status: string }[] }[]

  const attendance = Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    const rows = attendanceRows.filter((row) => relation(row.appointments)?.appointment_date === key)
    return {
      date: shortDate(key),
      present: rows.filter((row) => row.status === 'Present').length,
      late: rows.filter((row) => row.status === 'Late').length,
      noShow: rows.filter((row) => row.status === 'No-Show').length,
    }
  })

  const queue = Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = dateKey(date)
    const rows = queueRows.filter((row) => row.queue_date === key)
    const waits = rows
      .filter((row) => row.called_at)
      .map((row) => Math.max(0, (new Date(row.called_at!).getTime() - new Date(row.created_at).getTime()) / 60000))
    return {
      day: shortDate(key),
      completed: rows.filter((row) => row.status === 'Completed').length,
      waitingMinutes: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0,
    }
  })

  const activities = ((activityResult.data ?? []) as {
    id: number
    activity_type: ActivityLog['type']
    actor_name: string
    action: ActivityLog['action']
    module: string
    description: string
    created_at: string
  }[]).map((row) => ({
    id: row.id,
    type: row.activity_type,
    actor: row.actor_name,
    action: row.action,
    module: row.module,
    description: row.description,
    dateTime: new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(', ', ', ').replace(/, (\d{1,2}:)/, ' · $1'),
  }))

  const todayAttendance = attendanceRows.filter((row) => relation(row.appointments)?.appointment_date === todayKey)
  const todayQueue = queueRows.filter((row) => row.queue_date === todayKey)
  const todayWaits = todayQueue.filter((row) => row.called_at).map((row) => Math.max(0, (new Date(row.called_at!).getTime() - new Date(row.created_at).getTime()) / 60000))
  const staff = (staffResult.data ?? []) as { status: 'active' | 'inactive' }[]

  return {
    attendance,
    queue,
    activities,
    attendedToday: todayAttendance.filter((row) => row.status !== 'No-Show').length,
    queueCompletedToday: todayQueue.filter((row) => row.status === 'Completed').length,
    activeQueueToday: todayQueue.filter((row) => row.status === 'Waiting' || row.status === 'Serving').length,
    averageWaitToday: todayWaits.length ? Math.round(todayWaits.reduce((sum, value) => sum + value, 0) / todayWaits.length) : 0,
    tomorrowAppointments: appointmentResult.count ?? 0,
    predictedAppointments: predictionRows.length,
    predictedNoShows: predictionRows.filter((row) => row.result === 'No-Show').length,
    staffTotal: staff.length,
    staffActive: staff.filter((row) => row.status === 'active').length,
    usesSyntheticPredictions: predictionRows.some((row) => row.model_version.includes('synthetic')),
    usesPilotPredictions: predictionRows.some((row) => row.model_version.includes('pilot')),
  }
}

export async function fetchPredictions(): Promise<PredictionRecord[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('probability, result, model_version, predicted_at, appointments!inner(appointment_date, appointment_time, patients!inner(patient_code))')
    .order('predicted_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as {
    probability: number
    result: PredictionRecord['result']
    predicted_at: string
    model_version: string
    appointments: { appointment_date: string; appointment_time: string; patients: { patient_code: string } | { patient_code: string }[] } | { appointment_date: string; appointment_time: string; patients: { patient_code: string } | { patient_code: string }[] }[]
  }[]).map((row) => {
    const appointment = relation(row.appointments)!
    const patient = relation(appointment.patients)!
    const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
    return {
      patient: patient.patient_code,
      appointment: appointmentDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(', ', ' · '),
      probability: Math.round(Number(row.probability) * 100),
      result: row.result,
      predictedAt: new Date(row.predicted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      modelVersion: row.model_version,
    }
  })
}

export async function fetchStaffAccounts(): Promise<StaffAccount[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, username, contact_number, status, created_at').eq('role', 'staff').order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as { id: string; full_name: string; username: string; contact_number: string | null; status: 'active' | 'inactive'; created_at: string }[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    contactNumber: row.contact_number ?? '',
    role: 'Health Center Staff',
    status: row.status === 'active' ? 'Active' : 'Inactive',
    createdAt: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }))
}

export async function updateStaffAccount(id: string, values: Pick<StaffAccount, 'fullName' | 'username' | 'contactNumber' | 'status'>) {
  const { error } = await supabase.from('profiles').update({
    full_name: values.fullName,
    username: values.username,
    contact_number: values.contactNumber,
    status: values.status.toLowerCase(),
  }).eq('id', id)
  if (error) throw error
}

export interface CreateStaffAccountInput {
  email: string
  password: string
  fullName: string
  username: string
  contactNumber: string
  status: StaffAccount['status']
}

export async function createStaffAccount(values: CreateStaffAccountInput) {
  const { error } = await supabase.functions.invoke('create-staff-user', { body: values })
  if (!error) return

  let message = error.message
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep the SDK error when the function did not return JSON.
    }
  }
  throw new Error(message)
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase.from('activity_logs').select('id, activity_type, actor_name, action, module, description, created_at').order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return ((data ?? []) as { id: number; activity_type: ActivityLog['type']; actor_name: string; action: ActivityLog['action']; module: string; description: string; created_at: string }[]).map((row) => ({
    id: row.id,
    type: row.activity_type,
    actor: row.actor_name,
    action: row.action,
    module: row.module,
    description: row.description,
    dateTime: new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/, (\d{1,2}:)/, ' · $1'),
  }))
}
