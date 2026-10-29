export type AccountStatus = 'Active' | 'Inactive'

export interface StaffAccount {
  id: string
  fullName: string
  username: string
  contactNumber: string
  role: 'Health Center Staff'
  status: AccountStatus
  createdAt: string
}

export type ActivityLogType = 'Staff Activity' | 'System Activity'

export type ActivityAction =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Login'
  | 'Logout'
  | 'Reminder'
  | 'Prediction'

export interface ActivityLog {
  id: number
  type: ActivityLogType
  actor: string
  action: ActivityAction
  module: string
  description: string
  dateTime: string
}

export interface AttendanceRecord {
  date: string
  present: number
  late: number
  noShow: number
}

export interface QueueRecord {
  day: string
  completed: number
  waitingMinutes: number
}

export interface PredictionRecord {
  patient: string
  appointment: string
  probability: number
  result: 'Show' | 'No-Show'
  predictedAt: string
  modelVersion: string
}

export interface Patient {
  id: string
  patientCode: string
  firstName: string
  lastName: string
  age: number
  gender: 'Female' | 'Male'
  contactNumber: string
  smsConsent: boolean
  address: string
  registeredAt: string
}

export interface HealthService {
  id: string
  name: string
  duration: number
}

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled'
export type ReminderStatus = 'Sent' | 'Queued' | 'Failed' | 'Not sent'

export interface Appointment {
  id: string
  appointmentCode: string
  patientId: string
  patientName: string
  serviceId: string
  serviceName: string
  date: string
  time: string
  status: AppointmentStatus
  remarks: string
  standardReminderStatus: ReminderStatus
  followUpReminderStatus: ReminderStatus
}

export type QueueStatus = 'Waiting' | 'Serving' | 'Completed'

export interface QueueEntry {
  id: string
  queueNumber: number
  patientName: string
  appointmentId: string
  appointmentCode: string
  appointmentTime: string
  serviceName: string
  status: QueueStatus
}

export type AttendanceStatus = 'Present' | 'Late' | 'No-Show'

export interface AttendanceEntry {
  id: string
  patientName: string
  appointmentId: string
  appointmentCode: string
  appointmentTime: string
  serviceName: string
  status: AttendanceStatus
  checkIn: string
  checkOut: string
}

export interface StaffPrediction {
  id: string
  patientName: string
  serviceName: string
  appointmentDateTime: string
  result: 'Show' | 'No-Show'
  probability: number
  risk: 'Low' | 'Moderate' | 'High'
  predictedAt: string
  reminderStatus: 'Sent' | 'Queued' | 'Failed' | 'Not sent' | 'Not required'
  modelVersion: string
}
