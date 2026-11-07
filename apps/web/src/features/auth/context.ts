import { createContext } from 'react'

export interface UserProfile {
  id: string
  email: string
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN'
  displayName: string
}

export interface AuthContextType {
  user: UserProfile | null
  token: string | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
