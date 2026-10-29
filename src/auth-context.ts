import { createContext, useContext } from 'react'

export type UserRole = 'admin' | 'staff'

export interface Session {
  userId: string
  email: string
  name: string
  role: UserRole
}

export interface AuthContextValue {
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<Session>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
