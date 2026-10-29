import { useId } from 'react'
import type { AttendanceRecord, QueueRecord } from '../types'

export function AttendanceBars({ data }: { data: AttendanceRecord[] }) {
  const max = Math.max(1, ...data.map((item) => item.present + item.late + item.noShow))

  if (!data.length) return <div className="grid min-h-48 place-items-center px-6 text-sm text-gray-500" role="status">No attendance data available.</div>

  return (
    <div>
      <p className="sr-only">Attendance data: {data.map((item) => `${item.date}, ${item.present} present, ${item.late} late, ${item.noShow} no-show`).join('; ')}.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 text-xs font-medium text-gray-500 sm:px-6">
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#5FAF9B]" />Present</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#D8A23C]" />Late</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#D66565]" />No-show</span>
      </div>
      <div className="mt-7 grid h-48 grid-cols-7 items-end gap-2 px-5 sm:gap-4 sm:px-6">
        {data.map((item) => (
          <div key={item.date} className="flex h-full flex-col justify-end gap-2">
            <div className="flex flex-1 items-end justify-center gap-0.5" title={`${item.date}: ${item.present} present, ${item.late} late, ${item.noShow} no-show`}>
              <div className="w-2.5 rounded-t bg-[#5FAF9B] sm:w-4" style={{ height: `${(item.present / max) * 100}%` }} />
              <div className="w-2.5 rounded-t bg-[#D8A23C] sm:w-4" style={{ height: `${(item.late / max) * 100}%` }} />
              <div className="w-2.5 rounded-t bg-[#D66565] sm:w-4" style={{ height: `${(item.noShow / max) * 100}%` }} />
            </div>
            <span className="text-center text-[10px] font-medium text-gray-400 sm:text-xs">{item.date.replace('Aug ', '').replace('Sep ', '')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function QueueLine({ data }: { data: QueueRecord[] }) {
  const width = 600
  const height = 170
  const padding = 20
  const max = Math.max(1, ...data.map((item) => item.completed)) + 5
  const gradientId = useId().replace(/:/g, '')
  const points = data.map((item, index) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(1, data.length - 1),
    y: height - padding - (item.completed / max) * (height - padding * 2),
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`

  if (!data.length) return <div className="grid min-h-48 place-items-center px-6 text-sm text-gray-500" role="status">No queue data available.</div>

  return (
    <div className="px-4 pb-1 sm:px-6">
      <p className="sr-only">Queue data: {data.map((item) => `${item.day}, ${item.completed} completed visits with ${item.waitingMinutes} minutes average waiting time`).join('; ')}.</p>
      <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Seven-day completed queue trend">
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = padding + lineIndex * ((height - padding * 2) / 3)
            return <line key={lineIndex} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#F4F1F3" strokeWidth="1" />
        })}
        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline points={line} fill="none" stroke="#C95F7C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={data[index].day}>
            <circle cx={point.x} cy={point.y} r="4" fill="white" stroke="#C95F7C" strokeWidth="3" />
            <text x={point.x} y={height - 1} textAnchor="middle" fill="#9ca3af" fontSize="10">{data[index].day.replace('Aug ', '').replace('Sep ', '')}</text>
          </g>
        ))}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8E4EA" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFF9FB" stopOpacity="0.12" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const safeValue = Math.min(100, Math.max(0, value))
  const offset = circumference - (safeValue / 100) * circumference

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#FDEBEC" strokeWidth="8" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#5FAF9B" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <strong className="block text-xl text-[#263238]">{safeValue}%</strong>
          <span className="text-[10px] font-semibold text-gray-400 uppercase">{label}</span>
        </div>
      </div>
    </div>
  )
}
