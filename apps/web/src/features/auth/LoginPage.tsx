import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DeliveryRider } from './DeliveryRider'
import { navigateAfterLogin } from './auth-navigation'
import { useReducedMotion } from './motion'
import { ROLE_HOME } from './session'
import { useAuth } from './useAuth'
import './auth.css'

function loginError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra và thử lại.'
    case 'auth/too-many-requests': return 'Bạn đã thử quá nhiều lần. Vui lòng đợi một chút rồi đăng nhập lại.'
    case 'auth/network-request-failed': return 'Không thể kết nối. Hãy kiểm tra mạng và thử lại.'
    case 'auth/user-disabled': return 'Tài khoản đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'
    default: return 'Chưa thể đăng nhập. Vui lòng thử lại hoặc liên hệ quản trị viên.'
  }
}

const order = (value: number) => ({ '--auth-order': value }) as CSSProperties

export function LoginPage() {
  const { user, loading, error: sessionError, login, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduced = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'signing' | 'verifying' | 'refreshing'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<{ email?: string; password?: string }>({})
  const alert = useRef<HTMLParagraphElement>(null)
  const submitting = useRef(false)
  const attempted = useRef(false)
  const navigated = useRef(false)
  const alive = useRef(true)
  const reviewed = useRef(new Set<'email' | 'password'>())
  const busy = loading || phase === 'signing' || phase === 'refreshing' || (phase === 'verifying' && !sessionError && !user)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (error || sessionError) alert.current?.focus() }, [error, sessionError])
  useEffect(() => {
    if (!user || loading) return
    let active = true
    const home = ROLE_HOME[user.role]
    const from: unknown = location.state?.from
    const target = typeof from === 'string' && (from === home || from.startsWith(home + '/')) ? from : home
    // Firebase sign-in alone is not sufficient: only the resolved backend profile can choose a route.
    queueMicrotask(() => {
      if (!active || navigated.current) return
      navigated.current = true
      const animate = attempted.current && !reduced
      navigateAfterLogin(fallback => navigate(target, { replace: true, state: { authArrival: fallback } }), animate)
    })
    return () => { active = false }
  }, [user, loading, location.state, navigate, reduced])

  function validateInput(name: 'email' | 'password', input: HTMLInputElement) {
    const message = name === 'email'
      ? !input.value.trim() ? 'Vui lòng nhập email.' : input.validity.typeMismatch ? 'Vui lòng nhập email hợp lệ.' : undefined
      : !input.value ? 'Vui lòng nhập mật khẩu.' : undefined
    setFields(current => ({ ...current, [name]: message }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || busy || user) return
    reviewed.current.add('email'); reviewed.current.add('password')
    const next: typeof fields = {}
    const input = event.currentTarget.elements.namedItem('email') as HTMLInputElement
    if (!email.trim()) next.email = 'Vui lòng nhập email.'
    else if (input.validity.typeMismatch) next.email = 'Vui lòng nhập email hợp lệ.'
    if (!password) next.password = 'Vui lòng nhập mật khẩu.'
    setFields(next)
    setError(null)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLInputElement>(next.email ? '#auth-email' : '#auth-password')?.focus()
      return
    }
    submitting.current = true
    attempted.current = true
    setPhase('signing')
    try {
      await login(email.trim(), password)
      if (alive.current) setPhase('verifying')
    } catch (failure) {
      if (alive.current) { setError(loginError(failure)); setPhase('idle') }
    } finally { submitting.current = false }
  }

  async function retrySession() {
    if (submitting.current || busy) return
    submitting.current = true
    attempted.current = true
    setError(null)
    setPhase('refreshing')
    try { await refresh(); if (alive.current) setPhase('verifying') }
    catch { if (alive.current) { setError('Chưa xác nhận được quyền. Vui lòng thử đăng nhập lại.'); setPhase('idle') } }
    finally { submitting.current = false }
  }

  return <main className="auth-page auth-login">
    <div className="auth-login-shell">
      <section className="auth-story" aria-label="ParcelFlow — Giao nhận bưu kiện">
        <div className="auth-brand" translate="no">Parcel<span>Flow</span><i>.</i></div>
        <div className="auth-story-copy">
          <p className="auth-eyebrow">KẾT NỐI MỖI CHUYẾN GIAO</p>
          <h2>Gửi trọn niềm tin.<br /><span>Giao từng khoảnh khắc.</span></h2>
          <p>Từ điểm lấy đến tận tay người nhận,<br className="auth-desktop-break" /> cùng ParcelFlow trên từng hành trình.</p>
        </div>
        <div className="auth-story-art"><DeliveryRider scenery /></div>
        <div className="auth-story-caption"><span aria-hidden="true">↗</span> Mỗi bưu kiện, một hành trình được kết nối.</div>
      </section>
      <section className="auth-card auth-login-card" aria-labelledby="auth-title">
        <div className="auth-stagger" style={order(0)}>
          <p className="auth-eyebrow">BẮT ĐẦU HÀNH TRÌNH CỦA BẠN</p>
          <h1 id="auth-title">Chào mừng trở lại</h1>
          <p className="auth-description">Đăng nhập để tiếp tục cùng ParcelFlow.</p>
        </div>
        <form noValidate onSubmit={submit} aria-busy={busy}>
          <div className="auth-field auth-stagger" style={order(1)}>
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" name="email" type="email" placeholder="Nhập email của bạn" spellCheck={false}
              autoCapitalize="none" autoComplete="username" required value={email} readOnly={busy}
              aria-invalid={!!fields.email} aria-describedby={fields.email ? 'auth-email-error' : undefined}
              onBlur={event => { reviewed.current.add('email'); validateInput('email', event.currentTarget) }}
              onChange={event => { setEmail(event.target.value); if (reviewed.current.has('email')) validateInput('email', event.currentTarget) }} />
            {fields.email && <span className="auth-field-error" id="auth-email-error" role="alert">{fields.email}</span>}
          </div>
          <div className="auth-field auth-stagger" style={order(2)}>
            <label htmlFor="auth-password">Mật khẩu</label>
            <div className="auth-password-wrap">
              <input id="auth-password" name="password" type={visible ? 'text' : 'password'} placeholder="Nhập mật khẩu"
                autoComplete="current-password" required value={password} readOnly={busy}
                aria-invalid={!!fields.password} aria-describedby={fields.password ? 'auth-password-error' : undefined}
                onBlur={event => { reviewed.current.add('password'); validateInput('password', event.currentTarget) }}
                onChange={event => { setPassword(event.target.value); if (reviewed.current.has('password')) validateInput('password', event.currentTarget) }} />
              <button type="button" className="auth-password-toggle" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={visible} aria-controls="auth-password" onClick={() => setVisible(current => !current)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                  {visible && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>
            {fields.password && <span className="auth-field-error" id="auth-password-error" role="alert">{fields.password}</span>}
          </div>
          <div className="auth-stagger" style={order(3)}>
            <button className="auth-submit" type="submit" disabled={busy || !!user}>
              {busy ? <><span className="auth-spinner" aria-hidden="true" />{phase === 'signing' ? 'Đang đăng nhập…' : 'Đang xác nhận quyền…'}</>
                : <><span>Đăng nhập</span><span aria-hidden="true">↗</span></>}
            </button>
            <p className="auth-progress" role="status">{busy ? 'Vui lòng đợi trong khi hệ thống xác minh tài khoản.' : ''}</p>
          </div>
        </form>
        {(error || sessionError) && <p role="alert" tabIndex={-1} ref={alert}>{error || sessionError}</p>}
        {sessionError && <button className="auth-retry" type="button" disabled={busy} onClick={retrySession}>Kiểm tra lại quyền</button>}
        <p className="auth-help auth-stagger" style={order(4)}>Cần tài khoản hoặc hỗ trợ đăng nhập?<br />Vui lòng liên hệ quản trị viên của nhóm.</p>
      </section>
    </div>
    <p className="auth-page-footer" translate="no">ParcelFlow <span>·</span> Kết nối những điều quan trọng.</p>
  </main>
}
