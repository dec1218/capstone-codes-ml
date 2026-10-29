import { followUpSkipReason, type FollowUpPrediction } from './reminder-policy.ts'

const modelVersion = 'rf-real-pilot-colab-v1'
const currentDate = '2026-10-29'
const appointmentUpdatedAt = '2026-10-29T06:00:00.000Z'
const validPrediction: FollowUpPrediction = {
  id: 'prediction-id',
  risk_level: 'High',
  model_version: modelVersion,
  predicted_at: '2026-10-29T07:00:00.000Z',
}

const assertEquals = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`)
}

Deno.test('accepts a current High real-pilot prediction', () => {
  assertEquals(followUpSkipReason(validPrediction, modelVersion, appointmentUpdatedAt, currentDate), null)
})

Deno.test('rejects a missing prediction', () => {
  assertEquals(followUpSkipReason(null, modelVersion, appointmentUpdatedAt, currentDate), 'noPrediction')
})

Deno.test('rejects a synthetic or wrong model version', () => {
  assertEquals(followUpSkipReason({ ...validPrediction, model_version: 'rf-synthetic-prototype-v1' }, modelVersion, appointmentUpdatedAt, currentDate), 'modelMismatch')
})

Deno.test('rejects Low and Moderate predictions', () => {
  assertEquals(followUpSkipReason({ ...validPrediction, risk_level: 'Moderate' }, modelVersion, appointmentUpdatedAt, currentDate), 'notHighRisk')
  assertEquals(followUpSkipReason({ ...validPrediction, risk_level: 'Low' }, modelVersion, appointmentUpdatedAt, currentDate), 'notHighRisk')
})

Deno.test('rejects a prediction from an earlier Manila day', () => {
  assertEquals(followUpSkipReason({ ...validPrediction, predicted_at: '2026-10-28T07:00:00.000Z' }, modelVersion, appointmentUpdatedAt, currentDate), 'stalePrediction')
})

Deno.test('rejects a prediction made before the appointment was changed', () => {
  assertEquals(followUpSkipReason({ ...validPrediction, predicted_at: '2026-10-29T05:00:00.000Z' }, modelVersion, appointmentUpdatedAt, currentDate), 'stalePrediction')
})
