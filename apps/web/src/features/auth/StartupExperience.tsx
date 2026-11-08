import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { AuthLoading } from './AuthLoading'
import { DeliveryRider } from './DeliveryRider'
import { hasSeenIntro, rememberIntro, useReducedMotion } from './motion'
import { useAuth } from './useAuth'
import './auth.css'

export function StartupExperience({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const reduced = useReducedMotion()
  const location = useLocation()
  const [phase, setPhase] = useState<'checking' | 'intro' | 'ready'>(() =>
    loading ? 'checking' : user || reduced || hasSeenIntro() ? 'ready' : 'intro')
  useEffect(() => {
    if (phase === 'intro' || (phase === 'ready' && (user || reduced))) rememberIntro()
    const bypassIntro = phase === 'intro' && (user || reduced)
    if (!bypassIntro && (phase !== 'checking' || loading)) return
    // The initial decision waits for Auth; later sign-in refreshes must not restart startup.
    let active = true
    queueMicrotask(() => {
      if (!active) return
      if (bypassIntro || user || reduced || hasSeenIntro()) { rememberIntro(); setPhase('ready') }
      else setPhase('intro')
    })
    return () => { active = false }
  }, [phase, loading, user, reduced])
  const intro = phase === 'intro' && !user && !reduced
  return <div className="app-experience" data-stage={intro ? 'intro' : phase === 'checking' ? 'checking' : 'ready'}>
    {phase === 'checking' ? <AuthLoading /> : <div className={location.state?.authArrival ? 'auth-arrival' : undefined} inert={intro}>
      {children}
    </div>}
    {intro && <DeliveryIntro onComplete={() => setPhase('ready')} />}
  </div>
}

function DeliveryIntro({ onComplete }: { onComplete: () => void }) {
  const cover = useRef<HTMLDivElement>(null)
  const rider = useRef<HTMLDivElement>(null)
  const brand = useRef<HTMLDivElement>(null)
  const finish = useRef(onComplete)
  useEffect(() => { finish.current = onComplete }, [onComplete])
  useEffect(() => {
    const car = rider.current!, wordmark = brand.current!, overlay = cover.current!
    if (!car.animate) { finish.current(); return }
    const distance = window.innerWidth / 2 + 320
    const animations = [
      car.animate([
        { transform: `translateX(${-distance}px)`, offset: 0, easing: 'cubic-bezier(.16, 1, .3, 1)' },
        { transform: 'translateX(0)', offset: .3125 },
        { transform: 'translateX(0)', offset: .6875, easing: 'cubic-bezier(.7, 0, .9, .4)' },
        { transform: `translateX(${distance}px)`, offset: 1 },
      ], { duration: 1600, fill: 'both' }),
      wordmark.animate([
        { opacity: 0, transform: 'translateY(12px)', offset: 0 },
        { opacity: 0, transform: 'translateY(12px)', offset: .1875 },
        { opacity: 1, transform: 'translateY(0)', offset: .5 },
        { opacity: 1, transform: 'translateY(0)', offset: .6875 },
        { opacity: 0, transform: 'translateY(-6px)', offset: 1 },
      ], { duration: 1600, fill: 'both', easing: 'cubic-bezier(.2, .8, .2, 1)' }),
      overlay.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: .75 }, { opacity: 0, offset: 1 }],
        { duration: 1600, fill: 'both' }),
    ]
    let active = true
    void Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (active) finish.current()
    }).catch(() => {})
    return () => { active = false; animations.forEach(animation => animation.cancel()) }
  }, [])
  return <div className="auth-intro" ref={cover} data-testid="startup-intro">
    <div className="auth-intro-scene">
      <div className="auth-intro-rider" ref={rider}><DeliveryRider /></div>
      <div className="auth-intro-brand" ref={brand}>
        <div translate="no">Parcel<span>Flow</span><i>.</i></div>
        <p>Gửi trọn niềm tin, giao từng khoảnh khắc.</p>
      </div>
    </div>
    <button className="auth-intro-skip" type="button" onClick={onComplete}>Bỏ qua giới thiệu</button>
  </div>
}
