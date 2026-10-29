import { supabase } from './supabase'
import type {
  Appointment,
  AttendanceEntry,
  AttendanceRecord,
  AttendanceStatus,
  HealthService,
  Patient,
  QueueEntry,
  QueueRecord,
  QueueStatus,
  ReminderStatus,
  StaffPrediction,
} from '../types'

const relation = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value

export const dateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shortDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const displayDate = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timeValue = (value: string | null) => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

function friendlyError(error: { code?: string; message: string }, fallback: string) {
  if (error.code === '23505') {
    if (error.message.includes('appointments_patient_id_appointment_date_appointment_time_key')) return new Error('This patient already has an appointment at that date and time.')
    if (error.message.includes('queue_one_serving_per_day')) return new Error('Another patient is already being served. Refresh the queue and try again.')
    if (error.message.includes('queue_entries_appointment_id_key')) return new Error('This appointment already has a queue number.')
    if (error.message.includes('queue_entries_queue_date_queue_number_key')) return new Error('That queue number was just assigned. Refresh and try again.')
  }
  return new Error(error.message || fallback)
}

interface PatientRow {
  id: string
  patient_code: string
  first_name: string
  last_name: string
  age: number
  gender: Patient['gender']
  contact_number: string
  sms_consent: boolean
  address: string
  registered_at: string
}

const mapPatient = (row: PatientRow): Patient => ({
  id: row.id,
  patientCode: row.patient_code,
  firstName: row.first_name,
  lastName: row.last_name,
  age: row.age,
  gender: row.gender,
  contactNumber: row.contact_number,
  smsConsent: row.sms_consent,
  address: row.address,
  registeredAt: displayDate(row.registered_at),
})

export type PatientInput = Pick<Patient, 'firstName' | 'lastName' | 'age' | 'gender' | 'contactNumber' | 'smsConsent' | 'address'>

export async function fetchPatients(): Promise<Patient[]> {
  const { data, error } = await supabase.from('patients').select('id, patient_code, first_name, last_name, age, gender, contact_number, sms_consent, address, registered_at').order('registered_at', { ascending: false })
  if (error) throw friendlyError(error, 'Unable to load patients.')
  return ((data ?? []) as PatientRow[]).map(mapPatient)
}

export async function createPatient(values: PatientInput, userId: string): Promise<Patient> {
  const { data, error } = await supabase.from('patients').insert({
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    age: values.age,
    gender: values.gender,
    contact_number: values.contactNumber.replace(/\s/g, ''),
    sms_consent: values.smsConsent,
    address: values.address.trim(),
    created_by: userId,
  }).select('id, patient_code, first_name, last_name, age, gender, contact_number, sms_consent, address, registered_at').single()
  if (error) throw friendlyError(error, 'Unable to register the patient.')
  return mapPatient(data as PatientRow)
}

export async function updatePatient(id: string, values: PatientInput): Promise<Patient> {
  const { data, error } = await supabase.from('patients').update({
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    age: values.age,
    gender: values.gender,
    contact_number: values.contactNumber.replace(/\s/g, ''),
    sms_consent: values.smsConsent,
    address: values.address.trim(),
  }).eq('id', id).select('id, patient_code, first_name, last_name, age, gender, contact_number, sms_consent, address, registered_at').single()
  if (error) throw friendlyError(error, 'Unable to update the patient.')
  return mapPatient(data as PatientRow)
}

interface AppointmentRow {
  id: string
  appointment_code: string
  patient_id: string
  service_id: string
  appointment_date: string
  appointment_time: string
  status: Appointment['status']
  remarks: string
  patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]
  health_services: { name: string } | { name: string }[]
  notification_logs: { status: 'Sent' | 'Queued' | 'Failed' | 'Not required'; reminder_type: ReminderType; created_at: string }[]
}

const mapAppointment = (row: AppointmentRow): Appointment => {
  const patient = relation(row.patients)!
  const service = relation(row.health_services)!
  const reminderStatus = (type: ReminderType): ReminderStatus => {
    const reminder = row.notification_logs
      ?.filter((item) => item.reminder_type === type)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return reminder?.status === 'Not required' || !reminder ? 'Not sent' : reminder.status
  }
  return {
    id: row.id,
    appointmentCode: row.appointment_code,
    patientId: row.patient_id,
    patientName: `${patient.first_name} ${patient.last_name}`,
    serviceId: row.service_id,
    serviceName: service.name,
    date: row.appointment_date,
    time: row.appointment_time.slice(0, 5),
    status: row.status,
    remarks: row.remarks,
    standardReminderStatus: reminderStatus('standard'),
    followUpReminderStatus: reminderStatus('high_risk_follow_up'),
  }
}

const appointmentSelect = 'id, appointment_code, patient_id, service_id, appointment_date, appointment_time, status, remarks, patients!inner(first_name, last_name), health_services!inner(name), notification_logs(status, reminder_type, created_at)'

export async function fetchAppointments(from?: string, to?: string): Promise<Appointment[]> {
  let query = supabase.from('appointments').select(appointmentSelect).order('appointment_date', { ascending: false }).order('appointment_time', { ascending: true })
  if (from) query = query.gte('appointment_date', from)
  if (to) query = query.lte('appointment_date', to)
  const { data, error } = await query
  if (error) throw friendlyError(error, 'Unable to load appointments.')
  return ((data ?? []) as unknown as AppointmentRow[]).map(mapAppointment)
}

export async function fetchHealthServices(): Promise<HealthService[]> {
  const { data, error } = await supabase.from('health_services').select('id, name, duration_minutes').eq('is_active', true).order('name')
  if (error) throw friendlyError(error, 'Unable to load health services.')
  return ((data ?? []) as { id: string; name: string; duration_minutes: number }[]).map((row) => ({ id: row.id, name: row.name, duration: row.duration_minutes }))
}

export interface AppointmentInput {
  patientId: string
  serviceId: string
  date: string
  time: string
  remarks: string
}

export async function createAppointment(values: AppointmentInput, userId: string): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').insert({ patient_id: values.patientId, service_id: values.serviceId, appointment_date: values.date, appointment_time: values.time, remarks: values.remarks.trim(), created_by: userId }).select(appointmentSelect).single()
  if (error) throw friendlyError(error, 'Unable to create the appointment.')
  return mapAppointment(data as unknown as AppointmentRow)
}

export async function rescheduleAppointment(id: string, values: AppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').update({ patient_id: values.patientId, service_id: values.serviceId, appointment_date: values.date, appointment_time: values.time, remarks: values.remarks.trim(), status: 'Scheduled' }).eq('id', id).select(appointmentSelect).single()
  if (error) throw friendlyError(error, 'Unable to reschedule the appointment.')
  return mapAppointment(data as unknown as AppointmentRow)
}

export async function cancelAppointment(id: string) {
  const { error } = await supabase.from('appointments').update({ status: 'Cancelled' }).eq('id', id)
  if (error) throw friendlyError(error, 'Unable to cancel the appointment.')
}

export interface ReminderRunResult {
  version?: string
  provider: 'mock' | 'philsms'
  appointmentDate: string
  reminderType: ReminderType
  requiredModelVersion: string | null
  eligible: number
  sent: number
  skipped: number
  consentSkipped: number
  skipReasons?: {
    noConsent: number
    noPrediction: number
    notHighRisk: number
    modelMismatch: number
    stalePrediction: number
    alreadySent: number
    retryLimit: number
    activeAttempt: number
    concurrentRun: number
  }
  failed: number
  failureReason: string | null
}

export type ReminderType = 'standard' | 'high_risk_follow_up'

export async function runAppointmentReminders(reminderType: ReminderType): Promise<ReminderRunResult> {
  const { data, error } = await supabase.functions.invoke<ReminderRunResult>('send-appointment-reminders', { body: { reminderType } })
  if (!error && data) return data

  let message = error?.message ?? 'The reminder service returned no result.'
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep the SDK message when the function did not return JSON.
    }
  }
  throw new Error(message)
}

export interface PatientHistoryEntry {
  id: string
  appointmentCode: string
  serviceName: string
  date: string
  status: Appointment['status'] | AttendanceStatus
}

export async function fetchPatientHistory(patientId: string): Promise<PatientHistoryEntry[]> {
  const { data, error } = await supabase.from('appointments').select('id, appointment_code, appointment_date, status, health_services!inner(name), attendance(status)').eq('patient_id', patientId).order('appointment_date', { ascending: false })
  if (error) throw friendlyError(error, 'Unable to load service history.')
  return ((data ?? []) as unknown as { id: string; appointment_code: string; appointment_date: string; status: Appointment['status']; health_services: { name: string } | { name: string }[]; attendance: { status: AttendanceStatus } | { status: AttendanceStatus }[] | null }[]).map((row) => ({
    id: row.id,
    appointmentCode: row.appointment_code,
    serviceName: relation(row.health_services)!.name,
    date: row.appointment_date,
    status: relation(row.attendance)?.status ?? row.status,
  }))
}

interface QueueRow {
  id: string
  queue_number: number
  status: QueueStatus
  appointments: { id: string; appointment_code: string; appointment_time: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[] } | { id: string; appointment_code: string; appointment_time: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[] }[]
}

const mapQueue = (row: QueueRow): QueueEntry => {
  const appointment = relation(row.appointments)!
  const patient = relation(appointment.patients)!
  return {
    id: row.id,
    queueNumber: row.queue_number,
    patientName: `${patient.first_name} ${patient.last_name}`,
    appointmentId: appointment.id,
    appointmentCode: appointment.appointment_code,
    appointmentTime: appointment.appointment_time.slice(0, 5),
    serviceName: relation(appointment.health_services)!.name,
    status: row.status,
  }
}

export async function fetchTodayQueue(): Promise<QueueEntry[]> {
  const { data, error } = await supabase.from('queue_entries').select('id, queue_number, status, appointments!inner(id, appointment_code, appointment_time, patients!inner(first_name, last_name), health_services!inner(name))').eq('queue_date', dateKey()).order('queue_number')
  if (error) throw friendlyError(error, 'Unable to load today’s queue.')
  return ((data ?? []) as unknown as QueueRow[]).map(mapQueue)
}

export async function fetchQueueAppointments(): Promise<Appointment[]> {
  const today = dateKey()
  const [appointments, queue] = await Promise.all([fetchAppointments(today, today), fetchTodayQueue()])
  const queuedIds = new Set(queue.map((entry) => entry.appointmentId))
  return appointments.filter((appointment) => appointment.status === 'Scheduled' && !queuedIds.has(appointment.id))
}

export async function assignQueueNumber(appointmentId: string, userId: string) {
  const today = dateKey()
  const { data: last, error: readError } = await supabase.from('queue_entries').select('queue_number').eq('queue_date', today).order('queue_number', { ascending: false }).limit(1).maybeSingle()
  if (readError) throw friendlyError(readError, 'Unable to determine the next queue number.')
  const { error } = await supabase.from('queue_entries').insert({ appointment_id: appointmentId, queue_date: today, queue_number: (last?.queue_number ?? 0) + 1, created_by: userId })
  if (error) throw friendlyError(error, 'Unable to assign a queue number.')
}

export async function updateQueueStatus(id: string, status: QueueStatus) {
  const today = dateKey()
  if (status === 'Serving') {
    const { error: demoteError } = await supabase.from('queue_entries').update({ status: 'Waiting', called_at: null }).eq('queue_date', today).eq('status', 'Serving').neq('id', id)
    if (demoteError) throw friendlyError(demoteError, 'Unable to update the current queue.')
  }
  const values = status === 'Serving'
    ? { status, called_at: new Date().toISOString(), completed_at: null }
    : status === 'Completed'
      ? { status, completed_at: new Date().toISOString() }
      : { status, called_at: null, completed_at: null }
  const { error } = await supabase.from('queue_entries').update(values).eq('id', id)
  if (error) throw friendlyError(error, 'Unable to update the queue status.')
}

interface AttendanceRow {
  id: string
  status: AttendanceStatus
  check_in: string | null
  check_out: string | null
  appointments: { id: string; appointment_code: string; appointment_time: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[] } | { id: string; appointment_code: string; appointment_time: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[] }[]
}

export async function fetchTodayAttendance(): Promise<AttendanceEntry[]> {
  const { data, error } = await supabase.from('attendance').select('id, status, check_in, check_out, appointments!inner(id, appointment_code, appointment_date, appointment_time, patients!inner(first_name, last_name), health_services!inner(name))').eq('appointments.appointment_date', dateKey()).order('created_at')
  if (error) throw friendlyError(error, 'Unable to load attendance.')
  return ((data ?? []) as unknown as AttendanceRow[]).map((row) => {
    const appointment = relation(row.appointments)!
    const patient = relation(appointment.patients)!
    return { id: row.id, patientName: `${patient.first_name} ${patient.last_name}`, appointmentId: appointment.id, appointmentCode: appointment.appointment_code, appointmentTime: appointment.appointment_time.slice(0, 5), serviceName: relation(appointment.health_services)!.name, status: row.status, checkIn: timeValue(row.check_in), checkOut: timeValue(row.check_out) }
  })
}

export interface AttendanceInput {
  appointmentId: string
  status: AttendanceStatus
  checkIn: string
  checkOut: string
}

export async function markAttendance(values: AttendanceInput, userId: string) {
  const today = dateKey()
  const timestamp = (time: string) => new Date(`${today}T${time}:00`).toISOString()
  const payload = {
    appointment_id: values.appointmentId,
    status: values.status,
    check_in: values.status === 'No-Show' ? null : timestamp(values.checkIn),
    check_out: values.status === 'No-Show' || !values.checkOut ? null : timestamp(values.checkOut),
    recorded_by: userId,
  }
  const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'appointment_id' })
  if (error) throw friendlyError(error, 'Unable to save attendance.')
}

export interface StaffOverview {
  appointments: Appointment[]
  queue: QueueEntry[]
  attendance: AttendanceEntry[]
  highRisk: number
  averageWait: number
  usesSyntheticPredictions: boolean
  usesPilotPredictions: boolean
}

export async function fetchStaffOverview(): Promise<StaffOverview> {
  const today = dateKey()
  const [appointments, queue, attendance, predictionResult, waitsResult] = await Promise.all([
    fetchAppointments(today, today),
    fetchTodayQueue(),
    fetchTodayAttendance(),
    supabase.from('predictions').select('id, model_version, appointments!inner(appointment_date)').eq('risk_level', 'High').eq('appointments.appointment_date', today),
    supabase.from('queue_entries').select('created_at, called_at').eq('queue_date', today).not('called_at', 'is', null),
  ])
  if (predictionResult.error) throw friendlyError(predictionResult.error, 'Unable to load prediction totals.')
  if (waitsResult.error) throw friendlyError(waitsResult.error, 'Unable to load queue timing.')
  const waits = ((waitsResult.data ?? []) as { created_at: string; called_at: string }[]).map((row) => Math.max(0, (new Date(row.called_at).getTime() - new Date(row.created_at).getTime()) / 60000))
  return { appointments, queue, attendance, highRisk: predictionResult.data?.length ?? 0, averageWait: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0, usesSyntheticPredictions: (predictionResult.data ?? []).some((row) => row.model_version.includes('synthetic')), usesPilotPredictions: (predictionResult.data ?? []).some((row) => row.model_version.includes('pilot')) }
}

export async function fetchStaffPredictions(appointmentDate: string): Promise<StaffPrediction[]> {
  const { data, error } = await supabase.from('predictions').select('id, probability, result, risk_level, model_version, predicted_at, appointments!inner(appointment_date, appointment_time, status, patients!inner(first_name, last_name), health_services!inner(name), notification_logs(status, reminder_type, created_at))').eq('appointments.appointment_date', appointmentDate).eq('appointments.status', 'Scheduled').order('predicted_at', { ascending: false })
  if (error) throw friendlyError(error, 'Unable to load predictions.')
  return ((data ?? []) as unknown as { id: string; probability: number; result: StaffPrediction['result']; risk_level: StaffPrediction['risk']; model_version: string; predicted_at: string; appointments: { appointment_date: string; appointment_time: string; status: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[]; notification_logs: { status: StaffPrediction['reminderStatus']; reminder_type: ReminderType; created_at: string }[] } | { appointment_date: string; appointment_time: string; status: string; patients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[]; health_services: { name: string } | { name: string }[]; notification_logs: { status: StaffPrediction['reminderStatus']; reminder_type: ReminderType; created_at: string }[] }[] }[]).map((row) => {
    const appointment = relation(row.appointments)!
    const patient = relation(appointment.patients)!
    const followUp = appointment.notification_logs
      ?.filter((item) => item.reminder_type === 'high_risk_follow_up')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const reminderStatus = row.risk_level === 'High' ? followUp?.status ?? 'Not sent' : 'Not required'
    return { id: row.id, patientName: `${patient.first_name} ${patient.last_name}`, serviceName: relation(appointment.health_services)!.name, appointmentDateTime: new Date(`${appointment.appointment_date}T${appointment.appointment_time}`).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(', ', ' · '), result: row.result, probability: Math.round(Number(row.probability) * 100), risk: row.risk_level, predictedAt: new Date(row.predicted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/, (\d{1,2}:)/, ' · $1'), reminderStatus, modelVersion: row.model_version }
  })
}

export interface StaffReportData {
  attendance: AttendanceRecord[]
  appointments: Appointment[]
  queue: QueueRecord[]
}

export async function fetchStaffReport(from: string, to: string): Promise<StaffReportData> {
  const [attendanceResult, appointments, queueResult] = await Promise.all([
    supabase.from('attendance').select('status, appointments!inner(appointment_date)').gte('appointments.appointment_date', from).lte('appointments.appointment_date', to),
    fetchAppointments(from, to),
    supabase.from('queue_entries').select('queue_date, status, created_at, called_at').gte('queue_date', from).lte('queue_date', to),
  ])
  if (attendanceResult.error) throw friendlyError(attendanceResult.error, 'Unable to generate the attendance report.')
  if (queueResult.error) throw friendlyError(queueResult.error, 'Unable to generate the queue report.')
  const attendanceRows = (attendanceResult.data ?? []) as unknown as { status: AttendanceStatus; appointments: { appointment_date: string } | { appointment_date: string }[] }[]
  const queueRows = (queueResult.data ?? []) as { queue_date: string; status: QueueStatus; created_at: string; called_at: string | null }[]
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (cursor <= end) { dates.push(dateKey(cursor)); cursor.setDate(cursor.getDate() + 1) }
  return {
    attendance: dates.map((date) => { const rows = attendanceRows.filter((row) => relation(row.appointments)?.appointment_date === date); return { date: shortDate(date), present: rows.filter((row) => row.status === 'Present').length, late: rows.filter((row) => row.status === 'Late').length, noShow: rows.filter((row) => row.status === 'No-Show').length } }),
    appointments,
    queue: dates.map((date) => { const rows = queueRows.filter((row) => row.queue_date === date); const waits = rows.filter((row) => row.called_at).map((row) => Math.max(0, (new Date(row.called_at!).getTime() - new Date(row.created_at).getTime()) / 60000)); return { day: shortDate(date), completed: rows.filter((row) => row.status === 'Completed').length, waitingMinutes: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0 } }),
  }
}
