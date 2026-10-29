import { supabase } from './supabase'

const mlApiUrl = (import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export interface PredictionRunResult {
  appointment_date: string
  model_version: string
  generated: number
  skipped: number
  skipped_services: string[]
}

export async function runNoShowPredictions(appointmentDate?: string): Promise<PredictionRunResult> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Your secure session is unavailable. Sign in again and retry.')

  const query = appointmentDate ? `?appointment_date=${encodeURIComponent(appointmentDate)}` : ''
  let response: Response
  try {
    response = await fetch(`${mlApiUrl}/predictions/run${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
  } catch {
    throw new Error('The local prediction service is unavailable. Start FastAPI and retry.')
  }

  const body = await response.json().catch(() => null) as PredictionRunResult | { detail?: string } | null
  if (!response.ok) {
    const detail = body && 'detail' in body ? body.detail : null
    throw new Error(detail || 'The prediction service could not complete this run.')
  }
  return body as PredictionRunResult
}
