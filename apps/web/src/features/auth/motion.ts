import { useSyncExternalStore } from 'react'

const INTRO_KEY = 'parcelflow:intro-seen:v1'
let seenInMemory = false
const media = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const subscribe = (notify: () => void) => {
  if (!window.matchMedia) return () => {}
  const query = media()
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const snapshot = () => typeof window !== 'undefined' && !!window.matchMedia && media().matches

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

export function hasSeenIntro() {
  try { return seenInMemory || sessionStorage.getItem(INTRO_KEY) === '1' }
  catch { return seenInMemory }
}

export function rememberIntro() {
  seenInMemory = true
  try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* Private modes can disable storage; keep this page session in memory. */ }
}
