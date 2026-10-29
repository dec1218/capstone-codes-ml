import { createClient } from 'npm:@supabase/supabase-js@2'
import { followUpSkipReason, type FollowUpPrediction, type ReminderType } from './reminder-policy.ts'

const functionVersion = 'philsms-v3'
const defaultHighRiskModelVersion = 'rf-real-pilot-colab-v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const manilaDate = (daysAhead = 0) => {
  const now = new Date(Date.now() + (8 * 60 * 60 * 1000))
  now.setUTCDate(now.getUTCDate() + daysAhead)
  return now.toISOString().slice(0, 10)
}

const relation = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const philSmsRecipient = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('0')) return `63${digits.slice(1)}`
  return digits
}

const responseMessage = (payload: Record<string, unknown>) => {
  for (const key of ['message', 'error', 'detail']) {
    if (typeof payload[key] === 'string') return payload[key].slice(0, 500)
  }
  return 'PhilSMS rejected the message.'
}

const responseId = (payload: Record<string, unknown>): string | null => {
  for (const key of ['message_id', 'id', 'uid']) {
    if (typeof payload[key] === 'string' || typeof payload[key] === 'number') return String(payload[key])
  }
  const data = payload.data
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) return data.length && data[0] && typeof data[0] === 'object' ? responseId(data[0] as Record<string, unknown>) : null
    return responseId(data as Record<string, unknown>)
  }
  return null
}

const parsePhilSmsResponse = async (response: Response) => {
  const rawBody = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {} } catch { payload = { message: rawBody } }
  return payload
}

async function verifyPhilSmsToken(token: string, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/balance`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const payload = await parsePhilSmsResponse(response)
  const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''
  if (!response.ok || payload.success === false || ['error', 'failed', 'failure'].includes(status)) {
    if (response.status === 401 || /unauth/i.test(responseMessage(payload))) throw new Error('PhilSMS rejected PHILSMS_API_TOKEN. Replace the Edge Function secret with a current token.')
    throw new Error(responseMessage(payload))
  }
}

async function sendWithPhilSms(token: string, apiBaseUrl: string, senderId: string, recipient: string, message: string) {
  const response = await fetch(`${apiBaseUrl}/sms/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient, sender_id: senderId, type: 'plain', message }),
  })
  const payload = await parsePhilSmsResponse(response)
  const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''
  if (!response.ok || payload.success === false || ['error', 'failed', 'failure'].includes(status)) {
    if (response.status === 401 || /unauth/i.test(responseMessage(payload))) throw new Error('PhilSMS rejected PHILSMS_API_TOKEN. Replace the Edge Function secret with a current token.')
    throw new Error(responseMessage(payload))
  }
  return responseId(payload)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method === 'GET') return respond({ function: 'send-appointment-reminders', version: functionVersion })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Function configuration is incomplete.' }, 500)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const configuredCronSecret = Deno.env.get('CRON_SECRET')
  const suppliedCronSecret = request.headers.get('x-cron-secret')
  const cronAuthorized = Boolean(configuredCronSecret && suppliedCronSecret && configuredCronSecret === suppliedCronSecret)
  let actorId: string | null = null
  let actorName = 'Automated Reminder Scheduler'

  if (!cronAuthorized) {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Authentication is required.' }, 401)
    const { data: userData, error: userError } = await adminClient.auth.getUser(authorization.slice('Bearer '.length))
    if (userError || !userData.user) return respond({ error: 'Your session is invalid or expired.' }, 401)
    const { data: profile, error: profileError } = await adminClient.from('profiles').select('full_name, role, status').eq('id', userData.user.id).single()
    if (profileError || !profile || profile.status !== 'active' || !['admin', 'staff'].includes(profile.role)) return respond({ error: 'Only active health-center accounts can run reminders.' }, 403)
    actorId = userData.user.id
    actorName = profile.full_name
  }

  const philSmsToken = Deno.env.get('PHILSMS_API_TOKEN')?.trim().replace(/^(['"])(.*)\1$/, '$2')
  const configuredProvider = Deno.env.get('SMS_PROVIDER')?.toLowerCase()
  if (configuredProvider && !['mock', 'philsms'].includes(configuredProvider)) return respond({ error: 'SMS_PROVIDER must be mock or philsms.' }, 500)
  const provider = configuredProvider ?? (philSmsToken ? 'philsms' : 'mock')
  if (provider === 'philsms' && !philSmsToken) return respond({ error: 'PHILSMS_API_TOKEN is required when SMS_PROVIDER is philsms.' }, 500)
  const senderId = Deno.env.get('PHILSMS_SENDER_ID')?.trim() || 'PhilSMS'
  const apiBaseUrl = (Deno.env.get('PHILSMS_API_BASE_URL')?.trim() || 'https://dashboard.philsms.com/api/v3').replace(/\/+$/, '')
  if (!apiBaseUrl.startsWith('https://')) return respond({ error: 'PHILSMS_API_BASE_URL must use HTTPS.' }, 500)
  if (provider === 'philsms') {
    try { await verifyPhilSmsToken(philSmsToken!, apiBaseUrl) } catch (reason) {
      return respond({ error: reason instanceof Error ? reason.message : 'Unable to verify the PhilSMS token.' }, 502)
    }
  }

  let requestedDate = ''
  let reminderType: ReminderType = 'standard'
  try {
    const body = await request.json() as { appointmentDate?: string; reminderType?: string }
    requestedDate = body.appointmentDate?.trim() ?? ''
    if (body.reminderType && !['standard', 'high_risk_follow_up'].includes(body.reminderType)) {
      return respond({ error: 'reminderType must be standard or high_risk_follow_up.' }, 400)
    }
    reminderType = body.reminderType as ReminderType || 'standard'
  } catch {
    // An empty body uses tomorrow in Asia/Manila.
  }
  const appointmentDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : manilaDate(1)
  const highRiskModelVersion = Deno.env.get('HIGH_RISK_MODEL_VERSION')?.trim() || defaultHighRiskModelVersion

  const { data: appointments, error: appointmentError } = await adminClient
    .from('appointments')
    .select('id, appointment_code, appointment_date, appointment_time, updated_at, patients!inner(first_name, contact_number, sms_consent), health_services!inner(name), predictions(id, risk_level, model_version, predicted_at)')
    .eq('appointment_date', appointmentDate)
    .eq('status', 'Scheduled')
    .order('appointment_time')
    .limit(100)
  if (appointmentError) return respond({ error: appointmentError.message }, 500)

  let sent = 0
  let skipped = 0
  let consentSkipped = 0
  let failed = 0
  let failureReason = ''
  const skipReasons = {
    noConsent: 0,
    noPrediction: 0,
    notHighRisk: 0,
    modelMismatch: 0,
    stalePrediction: 0,
    alreadySent: 0,
    retryLimit: 0,
    activeAttempt: 0,
    concurrentRun: 0,
  }

  for (const row of appointments ?? []) {
    const patient = relation(row.patients as { first_name: string; contact_number: string; sms_consent: boolean } | { first_name: string; contact_number: string; sms_consent: boolean }[])
    const service = relation(row.health_services as { name: string } | { name: string }[])
    const prediction = relation(row.predictions as FollowUpPrediction | FollowUpPrediction[])
    if (!patient || !service) { failed += 1; continue }
    if (!patient.sms_consent) { skipped += 1; consentSkipped += 1; skipReasons.noConsent += 1; continue }

    if (reminderType === 'high_risk_follow_up') {
      const reason = followUpSkipReason(prediction, highRiskModelVersion, String(row.updated_at), manilaDate())
      if (reason) { skipped += 1; skipReasons[reason] += 1; continue }
    }

    const { data: prior, error: priorError } = await adminClient.from('notification_logs').select('id, status, error_message, created_at').eq('appointment_id', row.id).eq('channel', 'SMS').eq('reminder_type', reminderType)
    if (priorError) { failed += 1; continue }
    const attempts = prior ?? []
    const deliveryAttempts = attempts.filter((item) => item.status !== 'Failed' || !/unauthenticated|PHILSMS_API_TOKEN/i.test(item.error_message ?? ''))
    if (attempts.some((item) => item.status === 'Sent')) { skipped += 1; skipReasons.alreadySent += 1; continue }
    if (deliveryAttempts.length >= 3) { skipped += 1; skipReasons.retryLimit += 1; continue }
    const queuedAttempt = attempts.find((item) => item.status === 'Queued')
    if (queuedAttempt) {
      const staleBefore = Date.now() - (15 * 60 * 1000)
      if (new Date(queuedAttempt.created_at).getTime() >= staleBefore) { skipped += 1; skipReasons.activeAttempt += 1; continue }
      await adminClient.from('notification_logs').update({ status: 'Failed', error_message: 'Queued attempt expired before provider confirmation.' }).eq('id', queuedAttempt.id)
    }

    const recipient = philSmsRecipient(patient.contact_number)
    const message = reminderType === 'standard'
      ? `Hello ${patient.first_name}, reminder: ${service.name} on ${row.appointment_date} at ${String(row.appointment_time).slice(0, 5)}. - Barangay Health Center`
      : `Hello ${patient.first_name}, follow-up reminder: ${service.name} is tomorrow at ${String(row.appointment_time).slice(0, 5)}. Please contact the health center if unable to attend.`
    const { data: queued, error: queueError } = await adminClient.from('notification_logs').insert({
      appointment_id: row.id,
      prediction_id: reminderType === 'high_risk_follow_up' ? prediction!.id : null,
      channel: 'SMS',
      reminder_type: reminderType,
      recipient,
      status: 'Queued',
    }).select('id').single()
    if (queueError?.code === '23505') { skipped += 1; skipReasons.concurrentRun += 1; continue }
    if (queueError || !queued) { failed += 1; continue }

    try {
      const providerMessageId = provider === 'philsms'
        ? await sendWithPhilSms(philSmsToken!, apiBaseUrl, senderId, recipient, message)
        : `mock-${crypto.randomUUID()}`
      const { error: sentError } = await adminClient.from('notification_logs').update({ status: 'Sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString(), error_message: null }).eq('id', queued.id)
      if (sentError) throw sentError
      console.log(JSON.stringify({ provider, appointment: row.appointment_code, reminderType, providerMessageId }))
      sent += 1
    } catch (reason) {
      failed += 1
      const errorMessage = reason instanceof Error ? reason.message : 'SMS provider request failed.'
      if (!failureReason) failureReason = errorMessage
      await adminClient.from('notification_logs').update({ status: 'Failed', error_message: errorMessage.slice(0, 500) }).eq('id', queued.id)
    }
    if (provider === 'philsms') await wait(200)
  }

  await adminClient.from('activity_logs').insert({
    activity_type: cronAuthorized ? 'System Activity' : 'Staff Activity',
    actor_id: actorId,
    actor_name: actorName,
    action: 'Reminder',
    module: 'Appointments',
    description: `${provider === 'philsms' ? 'PhilSMS' : 'Mock'} ${reminderType === 'standard' ? 'standard reminder' : 'high-risk follow-up'} run for ${appointmentDate}: ${sent} sent, ${skipped} skipped, ${failed} failed.`,
    metadata: { function_version: functionVersion, provider, provider_host: provider === 'philsms' ? new URL(apiBaseUrl).host : null, appointment_date: appointmentDate, reminder_type: reminderType, required_model_version: reminderType === 'high_risk_follow_up' ? highRiskModelVersion : null, sent, skipped, consent_skipped: consentSkipped, skip_reasons: skipReasons, failed, trigger: cronAuthorized ? 'scheduled' : 'manual' },
  })

  return respond({ version: functionVersion, provider, appointmentDate, reminderType, requiredModelVersion: reminderType === 'high_risk_follow_up' ? highRiskModelVersion : null, eligible: appointments?.length ?? 0, sent, skipped, consentSkipped, skipReasons, failed, failureReason: failureReason || null })
})
