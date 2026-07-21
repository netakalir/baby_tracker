import type { Session, User } from '@supabase/supabase-js'
import { createContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  isEmailVerified: boolean
  isLoading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  return (
    <AuthContext.Provider value={{ session, user, isEmailVerified, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
