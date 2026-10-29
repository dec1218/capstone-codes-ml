export function formatTime(value: string) {
  if (!value || value === '—') return '—'
  const [hour, minute] = value.split(':').map(Number)
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}
