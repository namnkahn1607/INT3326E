import { flushSync } from 'react-dom'

export function navigateAfterLogin(commit: (fallback: boolean) => void, animate: boolean) {
  if (!animate || !document.startViewTransition) { commit(animate); return }
  document.documentElement.classList.add('auth-navigating')
  let committed = false
  try {
    const transition = document.startViewTransition(() => {
      if (committed) return
      committed = true
      flushSync(() => commit(false))
    })
    void transition.finished.catch(() => {
      if (!committed) { committed = true; commit(true) }
    }).finally(() => document.documentElement.classList.remove('auth-navigating'))
  } catch {
    document.documentElement.classList.remove('auth-navigating')
    if (!committed) commit(true)
  }
}
