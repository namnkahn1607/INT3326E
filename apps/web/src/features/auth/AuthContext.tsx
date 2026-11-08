import { useEffect, useRef, useState, type ReactNode } from 'react'
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { apiClient } from '../../api/client'
import { AuthContext, type UserProfile } from './context'
import { getClientAuth } from './firebase'
import { parseAccount, setTokenReader } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [setup] = useState(() => {
    try { return { auth: getClientAuth(), error: null } }
    catch (cause) { return { auth: null, error: cause instanceof Error ? cause.message : 'Không khởi tạo được đăng nhập.' } }
  })
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!setup.auth)
  const [error, setError] = useState<string | null>(setup.error)
  const version = useRef(0)
  const lastIdentity = useRef<string | null>(null)

  useEffect(() => {
    const auth = setup.auth
    if (!auth) return
    let active = true
    setTokenReader(async () => auth.currentUser ? auth.currentUser.getIdToken() : null)
    const unsubscribe = onIdTokenChanged(auth, async currentUser => {
      if (!active) return
      const currentVersion = ++version.current
      if (lastIdentity.current !== (currentUser?.uid ?? null)) {
        setLoading(true)
        setUser(null)
        setToken(null)
      }
      lastIdentity.current = currentUser?.uid ?? null
      setError(null)
      try {
        if (currentUser) {
          const jwt = await currentUser.getIdToken()
          const profile = parseAccount(await apiClient('/auth/me', { token: jwt }))
          if (profile.id !== currentUser.uid) throw new Error('Account mismatch')
          if (!active || version.current !== currentVersion) return
          setToken(jwt)
          setUser(profile)
        }
      } catch {
        if (active && version.current === currentVersion) {
          setUser(null)
          setToken(null)
          setError('Không xác nhận được quyền tài khoản. Hãy đăng nhập lại hoặc liên hệ người quản trị.')
        }
      } finally {
        if (active && version.current === currentVersion) setLoading(false)
      }
    }, () => {
      if (!active) return
      ++version.current
      setUser(null)
      setToken(null)
      setError('Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.')
      setLoading(false)
    })
    return () => { active = false; unsubscribe(); setTokenReader(async () => null) }
  }, [setup])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password)
  }

  const logout = async () => {
    ++version.current
    setLoading(false)
    setUser(null)
    setToken(null)
    await signOut(getClientAuth())
  }

  const refresh = async () => {
    const current = getClientAuth().currentUser
    if (!current) throw new Error('Vui lòng đăng nhập lại.')
    await current.getIdToken(true)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
