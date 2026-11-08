import './auth.css'

export function AuthLoading() {
  return <main className="auth-session-loading" aria-busy="true">
    <div className="auth-brand" translate="no">Parcel<span>Flow</span></div>
    <p role="status">Đang kiểm tra phiên đăng nhập…</p>
    <div className="auth-loading-lines" aria-hidden="true"><span /><span /><span /></div>
  </main>
}
