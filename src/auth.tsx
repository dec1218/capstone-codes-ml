import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type Session } from './auth-context'
import { supabase } from './lib/supabase'

interface ProfileRow {
  full_name: string
  role: 'admin' | 'staff'
  status: 'active' | 'inactive'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string, email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role, status')
      .eq('id', userId)
      .single<ProfileRow>()

    if (error || !data) throw new Error('Your account profile could not be loaded. Contact the administrator.')
    if (data.status !== 'active') throw new Error('This account is inactive. Contact the administrator.')

    const nextSession: Session = { userId, email, name: data.full_name, role: data.role }
    setSession(nextSession)
    return nextSession
  }

  useEffect(() => {
    let active = true

    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (!data.session?.user.email) {
        setSession(null)
        setLoading(false)
        return
      }

      try {
        await loadProfile(data.session.user.id, data.session.user.email)
      } catch {
        await supabase.auth.signOut()
        if (active) setSession(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void restoreSession()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!authSession?.user.email) {
        setSession(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error || !data.user.email) throw new Error('Incorrect email or password. Check your credentials and try again.')
    try {
      return await loadProfile(data.user.id, data.user.email)
    } catch (reason) {
      await supabase.auth.signOut()
      throw reason
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, loading, login, logout }}>{children}</AuthContext.Provider>
}
