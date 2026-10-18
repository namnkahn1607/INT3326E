import { getApps, initializeApp } from 'firebase/app'
import { browserSessionPersistence, connectAuthEmulator, getAuth, initializeAuth } from 'firebase/auth'

let connected = false

export function getClientAuth() {
  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_AUTH_DOMAIN: authDomain,
    VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId } = import.meta.env
  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Chưa cấu hình đăng nhập Firebase. Liên hệ người quản trị hệ thống.')
  }
  const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL
  if (emulator) {
    const url = new URL(emulator)
    if (!import.meta.env.DEV || !projectId.startsWith('demo-') ||
        url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        url.origin !== emulator) throw new Error('Cấu hình Firebase emulator không hợp lệ.')
  }
  const existing = getApps().find(app => app.name === 'parcelflow-web')
  if (existing && (existing.options.projectId !== projectId || existing.options.apiKey !== apiKey)) {
    throw new Error('Cấu hình đăng nhập đã thay đổi. Vui lòng tải lại trang.')
  }
  const auth = existing ? getAuth(existing) : initializeAuth(
    initializeApp({ apiKey, authDomain, projectId, appId }, 'parcelflow-web'),
    { persistence: browserSessionPersistence },
  )
  if (emulator && !connected) {
    connectAuthEmulator(auth, emulator)
    connected = true
  }
  return auth
}
