export type ReminderType = 'standard' | 'high_risk_follow_up'

export type FollowUpSkipReason = 'noPrediction' | 'notHighRisk' | 'modelMismatch' | 'stalePrediction'

export interface FollowUpPrediction {
  id: string
  risk_level: string
  model_version: string
  predicted_at: string
}

export const timestampManilaDate = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function followUpSkipReason(
  prediction: FollowUpPrediction | null,
  expectedModelVersion: string,
  appointmentUpdatedAt: string,
  currentManilaDate: string,
): FollowUpSkipReason | null {
  if (!prediction) return 'noPrediction'
  if (prediction.model_version !== expectedModelVersion) return 'modelMismatch'
  if (prediction.risk_level !== 'High') return 'notHighRisk'
  if (timestampManilaDate(prediction.predicted_at) !== currentManilaDate) return 'stalePrediction'
  if (new Date(prediction.predicted_at) < new Date(appointmentUpdatedAt)) return 'stalePrediction'
  return null
}
