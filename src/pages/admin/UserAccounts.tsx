import { Check, Pencil, Plus, Search, UserRoundX, UsersRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, EmptyState, ErrorState, Modal, PageHeader, Pagination, SkeletonRows } from '../../components/Ui'
import { createStaffAccount, fetchStaffAccounts, updateStaffAccount } from '../../lib/admin-data'
import type { AccountStatus, StaffAccount } from '../../types'

interface StaffForm {
  email: string
  fullName: string
  username: string
  contactNumber: string
  password: string
  status: AccountStatus
}

const emptyForm: StaffForm = {
  email: '',
  fullName: '',
  username: '',
  contactNumber: '',
  password: '',
  status: 'Active',
}

export function UserAccounts() {
  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof StaffForm, string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    fetchStaffAccounts().then((rows) => {
      if (active) setStaff(rows)
    }).catch((reason) => {
      if (active) setLoadError(reason instanceof Error ? reason.message : 'Unable to load staff accounts.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [reloadKey])

  const filteredStaff = staff.filter((account) => {
    const matchesQuery = `${account.fullName} ${account.username} ${account.contactNumber}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'All' || account.status === statusFilter)
  })

  const activeCount = staff.filter((account) => account.status === 'Active').length
  const pageSize = 4
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openCreate = () => {
    setForm(emptyForm)
    setErrors({})
    setSubmitError('')
    setEditingId(null)
    setModalMode('create')
  }

  const openEdit = (account: StaffAccount) => {
    setForm({
      email: '',
      fullName: account.fullName,
      username: account.username,
      contactNumber: account.contactNumber,
      password: '',
      status: account.status,
    })
    setErrors({})
    setSubmitError('')
    setEditingId(account.id)
    setModalMode('edit')
  }

  const validate = () => {
    const nextErrors: Partial<Record<keyof StaffForm, string>> = {}
    if (modalMode === 'create' && !/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid staff email address.'
    if (form.fullName.trim().length < 3) nextErrors.fullName = 'Enter the staff member’s full name.'
    if (!/^[a-z0-9._-]{4,}$/i.test(form.username)) nextErrors.username = 'Use at least 4 letters, numbers, dots, or underscores.'
    else if (staff.some((account) => account.id !== editingId && account.username.toLowerCase() === form.username.trim().toLowerCase())) nextErrors.username = 'This username is already assigned to another account.'
    if (!/^09\d{9}$/.test(form.contactNumber.replace(/\s/g, ''))) nextErrors.contactNumber = 'Enter an 11-digit Philippine mobile number.'
    if (modalMode === 'create' && form.password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    setSubmitError('')
    try {
      if (modalMode === 'create') {
        await createStaffAccount({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          contactNumber: form.contactNumber.replace(/\s/g, ''),
          status: form.status,
        })
        setStaff(await fetchStaffAccounts())
        setToast('Staff account created successfully.')
      } else if (editingId !== null) {
        await updateStaffAccount(editingId, {
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          contactNumber: form.contactNumber.replace(/\s/g, ''),
          status: form.status,
        })
        setStaff((current) => current.map((account) => account.id === editingId ? {
          ...account,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          contactNumber: form.contactNumber.replace(/\s/g, ''),
          status: form.status,
        } : account))
        setToast('Staff account changes saved.')
      }
      setModalMode(null)
      window.setTimeout(() => setToast(''), 2600)
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'Unable to save this account.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof StaffForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (submitError) setSubmitError('')
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access management"
        title="User accounts"
        description="Create and maintain access for Health Center Staff without exposing sensitive credentials."
        action={<button className="btn btn-primary" type="button" onClick={openCreate}><Plus size={17} /> Add staff account</button>}
      />

      {loadError ? <ErrorState description={loadError} onRetry={() => setReloadKey((value) => value + 1)} /> : <><section className="grid gap-4 sm:grid-cols-3" aria-label="Account summary">
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-[#c95676]"><UsersRound size={18} /></span>
          <div><p className="text-2xl font-bold text-[#2f3542]">{staff.length}</p><p className="text-xs text-gray-500">Total accounts</p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={18} /></span>
          <div><p className="text-2xl font-bold text-[#2f3542]">{activeCount}</p><p className="text-xs text-gray-500">Active accounts</p></div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-600"><UserRoundX size={18} /></span>
          <div><p className="text-2xl font-bold text-[#2f3542]">{staff.length - activeCount}</p><p className="text-xs text-gray-500">Inactive accounts</p></div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} aria-hidden="true" />
            <input className="field field-with-icon" type="search" placeholder="Search staff accounts" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} aria-label="Search staff accounts" />
          </div>
          <select className="field w-full sm:w-40" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as 'All' | AccountStatus); setPage(1) }} aria-label="Filter by account status">
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {loading ? <SkeletonRows count={4} /> : filteredStaff.length === 0 ? (
          <EmptyState title="No accounts found" description="Try a different search term or account-status filter." />
        ) : (
          <div className="table-scroll" role="region" aria-label="Staff accounts table" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-xs font-bold text-[#a84260]">{account.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                        <div><p className="font-semibold text-[#2f3542]">{account.fullName}</p><p className="mt-0.5 text-xs text-gray-400">@{account.username}</p></div>
                      </div>
                    </td>
                    <td>{account.contactNumber}</td>
                    <td>{account.role}</td>
                    <td><Badge tone={account.status === 'Active' ? 'success' : 'neutral'}>{account.status}</Badge></td>
                    <td>{account.createdAt}</td>
                    <td className="text-end">
                      <button className="btn btn-ghost min-h-9 px-3" type="button" onClick={() => openEdit(account)} aria-label={`Edit ${account.fullName}`}><Pencil size={15} /> Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {visibleStaff.length} of {filteredStaff.length} matching accounts</span>
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </footer>
      </section></>}

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? 'Create staff account' : 'Edit staff account'}
          description={modalMode === 'create' ? 'Create secure Supabase Auth access for a Health Center Staff member.' : 'Update profile and access status. Passwords are never displayed.'}
          onClose={() => setModalMode(null)}
        >
          <form onSubmit={submitForm} noValidate>
            <div className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6">
              {modalMode === 'create' && <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-gray-700">Email address</span>
                <input className="field" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" autoFocus />
                {errors.email && <span className="mt-1.5 block text-xs font-medium text-red-700">{errors.email}</span>}
              </label>}
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-gray-700">Full name</span>
                <input className="field" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} aria-invalid={Boolean(errors.fullName)} autoFocus={modalMode === 'edit'} />
                {errors.fullName && <span className="mt-1.5 block text-xs font-medium text-red-700">{errors.fullName}</span>}
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-gray-700">Username</span>
                <input className="field" value={form.username} onChange={(event) => updateField('username', event.target.value)} aria-invalid={Boolean(errors.username)} />
                {errors.username && <span className="mt-1.5 block text-xs font-medium text-red-700">{errors.username}</span>}
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-gray-700">Contact number</span>
                <input className="field" inputMode="tel" placeholder="09XXXXXXXXX" value={form.contactNumber} onChange={(event) => updateField('contactNumber', event.target.value)} aria-invalid={Boolean(errors.contactNumber)} />
                {errors.contactNumber && <span className="mt-1.5 block text-xs font-medium text-red-700">{errors.contactNumber}</span>}
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-gray-700">Role</span>
                <input className="field bg-gray-50 text-gray-500" value="Health Center Staff" disabled />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold text-gray-700">Account status</span>
                <select className="field" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              {modalMode === 'create' && <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-gray-700">Temporary password</span>
                <input className="field" type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} aria-invalid={Boolean(errors.password)} autoComplete="new-password" />
                <span className={`mt-1.5 block text-xs ${errors.password ? 'font-medium text-red-700' : 'text-gray-500'}`}>{errors.password ?? 'Use at least 8 characters and send it to the staff member securely.'}</span>
              </label>}
              {submitError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 sm:col-span-2" role="alert">{submitError}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
              <button className="btn btn-secondary" type="button" onClick={() => setModalMode(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : modalMode === 'create' ? 'Create account' : 'Save changes'}</button>
            </footer>
          </form>
        </Modal>
      )}

      {toast && <div className="fixed end-4 bottom-4 z-[80] flex max-w-sm items-center gap-3 rounded-xl bg-[#2f3542] px-4 py-3 text-sm font-medium text-white shadow-xl" role="status"><Check size={17} className="text-emerald-300" />{toast}</div>}
    </div>
  )
}
