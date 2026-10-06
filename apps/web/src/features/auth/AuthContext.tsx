import { useState, type ReactNode } from 'react'
import { AuthContext, type UserProfile } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>({
    id: 'demo-customer-1',
    email: 'demo@parcelflow.vn',
    role: 'CUSTOMER',
    displayName: 'Khách hàng demo',
  })
  const [token, setToken] = useState<string | null>(null)

  const login = (jwt: string, profile: UserProfile) => {
    setToken(jwt)
    setUser(profile)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
