import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './useAuth'

export function SessionControls() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)
  return <div className="auth-session">
    <span>{user?.displayName}</span>
    <button type="button" onClick={async () => {
      try { await logout(); navigate('/login', { replace: true }) }
      catch { setError(true) }
    }}>Đăng xuất</button>
    {error && <span role="alert">Không đăng xuất được. Hãy thử lại.</span>}
  </div>
}
