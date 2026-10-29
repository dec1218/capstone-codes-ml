import type { LucideIcon } from 'lucide-react'
import { AlertCircle, Beaker, ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'rose'

const badgeStyles: Record<BadgeTone, string> = {
  success: 'bg-[#E7F6F1] text-[#397D6D] ring-[#5FAF9B]/20',
  warning: 'bg-[#FFF4D8] text-[#916715] ring-[#D8A23C]/20',
  danger: 'bg-[#FDEBEC] text-[#B54F4F] ring-[#D66565]/20',
  info: 'bg-[#EEF4FC] text-[#4E73A7] ring-[#6B92C9]/20',
  neutral: 'bg-gray-100 text-gray-700 ring-gray-500/15',
  rose: 'bg-[#F8E4EA] text-[#B94F6D] ring-[#C95F7C]/20',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${badgeStyles[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div className="min-w-0 max-w-2xl">
        <p className="page-heading__eyebrow">{eyebrow}</p>
        <h1 className="page-heading__title">{title}</h1>
        <p className="page-heading__description">{description}</p>
      </div>
      {action && <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading flex flex-col items-start justify-between gap-4 px-5 pt-5 pb-4 sm:flex-row sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-[#263238]">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      {action && <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'rose',
}: {
  label: string
  value: string
  detail: ReactNode
  icon: LucideIcon
  tone?: 'rose' | 'green' | 'amber' | 'blue' | 'red'
}) {
  const iconStyles = {
    rose: 'bg-[#F8E4EA] text-[#963C56]',
    green: 'bg-[#E7F6F1] text-[#397D6D]',
    amber: 'bg-[#FFF4D8] text-[#916715]',
    blue: 'bg-[#EEF4FC] text-[#4E73A7]',
    red: 'bg-[#FDEBEC] text-[#B54F4F]',
  }

  return (
    <article className="card metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-6 text-gray-600">{label}</p>
          <p className="metric-card__value">{value}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconStyles[tone]}`}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </div>
      </div>
      <div className="metric-card__detail">{detail}</div>
    </article>
  )
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string
  description: string
  icon?: LucideIcon
}) {
  return (
    <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FFF9FB] text-[#963C56] ring-1 ring-inset ring-[#F1CCD7]">
          <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#263238]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
      </div>
    </div>
  )
}

export function PrototypeNotice({ historical = false }: { historical?: boolean }) {
  return (
    <aside className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900" role="note">
      <Beaker className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">{historical ? 'Historical synthetic prototype records' : 'Synthetic prototype model'}</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">{historical ? 'Older rows remain as technical integration evidence and are labelled Prototype in the table. New predictions use the real-data pilot.' : 'These predictions test the system integration only. They are not validated real-world risk assessments and do not control SMS delivery.'}</p>
      </div>
    </aside>
  )
}

export function PilotNotice() {
  return (
    <aside className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900" role="note">
      <Beaker className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Real-data pilot model</p>
        <p className="mt-1 text-xs leading-5 text-blue-800">Trained on 300 verified records for General Consultation, Immunization, and Prenatal Care. Results support staff review only, have limited future-period performance, and do not control SMS delivery.</p>
      </div>
    </aside>
  )
}

export function ErrorState({ title = 'We couldn’t load this view', description = 'Something went wrong while loading the requested information.', onRetry }: { title?: string; description?: string; onRetry: () => void }) {
  return (
    <div className="card grid min-h-64 place-items-center px-6 py-10 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#FDEBEC] text-[#B54F4F] ring-1 ring-inset ring-[#D66565]/15">
          <AlertCircle size={21} aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-bold text-[#263238]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        <button className="btn btn-secondary mt-5" type="button" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}

export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    const initialFocus = panel?.querySelector<HTMLElement>('[autofocus]')
      ?? panel?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
      ?? panel?.querySelector<HTMLElement>('button:not([disabled])')
    window.requestAnimationFrame(() => (initialFocus ?? panel)?.focus())

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
        <header className="flex items-start justify-between gap-5 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-[-0.02em] text-[#263238]">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-5 text-gray-500">{description}</p>
          </div>
          <button className="btn btn-ghost -mt-1 min-h-9 px-2" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  const lastPage = Math.max(1, totalPages)
  const currentPage = Math.min(Math.max(1, page), lastPage)
  const visiblePages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage]))
    .filter((value) => value >= 1 && value <= lastPage)
    .sort((a, b) => a - b)

  return (
    <nav className="flex items-center gap-1" aria-label="Table pagination">
      <button className="btn btn-ghost min-h-9 px-2" type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden="true" /></button>
      {visiblePages.map((value, index) => <span key={value} className="contents">{index > 0 && value - visiblePages[index - 1] > 1 && <span className="grid h-9 w-5 place-items-center text-xs text-gray-400" aria-hidden="true">…</span>}<button className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-bold transition-colors ${value === currentPage ? 'bg-[#263238] text-white shadow-sm' : 'text-gray-500 hover:bg-[#F8E4EA] hover:text-[#B94F6D]'}`} type="button" onClick={() => onPageChange(value)} aria-current={value === currentPage ? 'page' : undefined}>{value}</button></span>)}
      <button className="btn btn-ghost min-h-9 px-2" type="button" disabled={currentPage >= lastPage} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page"><ChevronRight className="size-4" aria-hidden="true" /></button>
    </nav>
  )
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-5" aria-label="Loading content" role="status">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}
