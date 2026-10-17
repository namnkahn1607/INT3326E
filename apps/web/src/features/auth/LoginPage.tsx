import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ROLE_HOME } from './session'
import { useAuth } from './useAuth'
import './auth.css'

export function LoginPage() {
  const { user, loading, error: sessionError, login, refresh } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (user) {
    const home = ROLE_HOME[user.role]
    const from: unknown = location.state?.from
    const target = typeof from === 'string' && (from === home || from.startsWith(home + '/')) ? from : home
    return <Navigate to={target} replace />
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try { await login(email.trim(), password); setPassword('') }
    catch { setError('Không đăng nhập được. Kiểm tra email, mật khẩu hoặc thử lại sau.'); setPassword('') }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-card">
    <h1>Đăng nhập ParcelFlow</h1>
    <p>Sử dụng tài khoản đã được cấp quyền.</p>
    <form onSubmit={submit}>
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="auth-password">Mật khẩu</label>
      <input id="auth-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit" disabled={busy || loading}>{busy || loading ? 'Đang xác thực…' : 'Đăng nhập'}</button>
    </form>
    {(error || sessionError) && <p role="alert">{error || sessionError}</p>}
    {sessionError && <button type="button" disabled={busy || loading} onClick={async () => {
      try { await refresh(); setError(null) } catch { setError('Vui lòng đăng nhập lại để cập nhật quyền.') }
    }}>Kiểm tra lại quyền</button>}
  </section></main>
}
