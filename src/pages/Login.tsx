import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { BrandLogo } from '../components/BrandLogo'

export function Login() {
  const { session, loading: sessionLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supportEmail = 'allynmarcdumapias202300160@gmail.com'
  const supportHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Password reset request - Smart Queue')}&body=${encodeURIComponent(`Account email: ${email || '[enter your account email]'}\nRole: Head Nurse / Staff\n\nPlease help me recover access to my account. I understand that I should never send my current password.`)}`

  if (sessionLoading) return <div className="grid min-h-[100dvh] place-items-center bg-[#FFF9FB] text-sm font-semibold text-gray-500"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Restoring secure session</div>
  if (session) return <Navigate to={session.role === 'admin' ? '/' : '/staff'} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter both your email and password.')
      return
    }

    setLoading(true)
    try {
      const nextSession = await login(email, password)
      const requestedPath = (location.state as { from?: string } | null)?.from
      const allowedPath = requestedPath && (nextSession.role === 'admin' ? !requestedPath.startsWith('/staff') : requestedPath.startsWith('/staff'))
      navigate(allowedPath ? requestedPath : nextSession.role === 'admin' ? '/' : '/staff', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-white lg:grid-cols-[minmax(24rem,0.9fr)_1.1fr]">
      <section className="flex items-center justify-center bg-[#FFF9FB] px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11" />
            <div><strong className="block text-base font-bold tracking-[-0.02em] text-[#263238]">Smart Queue & No Show Prediction</strong><span className="text-[11px] font-semibold tracking-[0.12em] text-gray-500 uppercase">Barangay Health Center</span></div>
          </div>

          <div className="mt-10 sm:mt-12">
            <p className="text-xs font-bold tracking-[0.16em] text-[#B94F6D] uppercase">Secure staff access</p>
            <h1 className="mt-2 text-[clamp(2rem,6vw,2.75rem)] leading-tight font-bold tracking-[-0.045em] text-[#263238]">Welcome back</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-gray-600">Sign in to access the workspace assigned to your health center role.</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={submit} aria-busy={loading} noValidate>
            <label className="block" htmlFor="email">
              <span className="mb-2 block text-xs font-semibold text-gray-700">Email address</span>
              <span className="relative block"><Mail className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-gray-400" aria-hidden="true" /><input id="email" className="field field-with-icon" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} autoComplete="username" placeholder="name@example.com" aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} /></span>
            </label>
            <label className="block" htmlFor="password">
              <span className="mb-2 block text-xs font-semibold text-gray-700">Password</span>
              <span className="relative block"><LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-gray-400" aria-hidden="true" /><input id="password" className="field field-with-icon pe-12" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} autoComplete="current-password" aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} /><button className="absolute end-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-[#2f3542]" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-[17px]" aria-hidden="true" /> : <Eye className="size-[17px]" aria-hidden="true" />}</button></span>
            </label>
            {error && <div id="login-error" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">{error}</div>}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="size-[17px] animate-spin" aria-hidden="true" />Signing in…</> : 'Sign in'}</button>
          </form>

          <div className="mt-7 rounded-xl border border-[#F1CCD7] bg-[#FFF9FB] p-4 text-xs leading-5 text-gray-600">
            <p className="font-bold text-[#263238]">Need help signing in?</p>
            <p className="mt-1">
              For account or password assistance, contact the system developer at{' '}
              <a className="font-semibold break-all text-[#963C56] underline decoration-[#DFA1B3] underline-offset-2 hover:text-[#803149]" href={supportHref}>
                {supportEmail}
              </a>.
            </p>
            <p className="mt-2 text-gray-500">Never include your current password in the message.</p>
          </div>
          <p className="mt-8 text-xs leading-5 text-gray-500">Authorized health center personnel only. Account activity is recorded for monitoring.</p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-[#263238] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src="/health-center.png" alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#C95F7C]/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#C95F7C]/10 blur-3xl" aria-hidden="true" />
      </aside>
    </main>
  )
}
