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
  login: (token: string, profile: UserProfile) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
