import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router'
import { SessionControls } from '../../features/auth/SessionControls'
import { useAuth } from '../../features/auth/useAuth'
import { Icon } from './Icon'

interface DashboardLink {
  path: string
  label: string
  icon: Parameters<typeof Icon>[0]['name']
  end?: boolean
}

export function DashboardNavigation({ home, workspace, items, navClass }: {
  home: string
  workspace: string
  items: DashboardLink[]
  navClass?: string
}) {
  const { user } = useAuth()
  const drawer = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const collapseButton = useRef<HTMLButtonElement>(null)
  const reopenButton = useRef<HTMLButtonElement>(null)
  const moveSidebarFocus = useRef(false)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (!moveSidebarFocus.current) return
    moveSidebarFocus.current = false
    const target = collapsed ? reopenButton : collapseButton
    target.current?.focus()
  }, [collapsed])
  function toggleSidebar() {
    moveSidebarFocus.current = true
    setCollapsed(value => !value)
  }
  useEffect(() => {
    if (!open) return
    const dialog = drawer.current!
    dialog.showModal()
    const desktop = window.matchMedia?.('(min-width: 901px)')
    const resize = () => { if (desktop?.matches) { dialog.close(); setOpen(false); trigger.current?.focus() } }
    desktop?.addEventListener('change', resize)
    return () => { desktop?.removeEventListener('change', resize); dialog.close() }
  }, [open])
  function close() {
    drawer.current?.close()
    setOpen(false)
    trigger.current?.focus()
  }
  const brand = <NavLink to={home} className="dashboard-brand" aria-label="ParcelFlow — Tổng quan" translate="no" onClick={open ? close : undefined}>
    <Icon name="box" /><span>ParcelFlow<span className="dashboard-brand-dot">.</span></span>
  </NavLink>
  const content = (mobile: boolean) => <>
    <div className="dashboard-sidebar-heading">{brand}{mobile
      ? <button type="button" className="dashboard-icon-button" aria-label="Đóng điều hướng" onClick={close}>×</button>
      : <button ref={collapseButton} type="button" className="dashboard-sidebar-toggle dashboard-icon-button" aria-label="Thu gọn thanh bên"
        title="Thu gọn thanh bên" aria-controls="dashboard-sidebar" aria-expanded={!collapsed} onClick={toggleSidebar}><Icon name="sidebar" /></button>}
    </div>
    <nav className={'dashboard-nav ' + (navClass ?? '')} aria-label={'Điều hướng ' + workspace.toLowerCase()}>
      {items.map(item => <NavLink key={item.path} to={item.path} end={item.end} onClick={mobile ? close : undefined}>
        <Icon name={item.icon} /><span>{item.label}</span>
      </NavLink>)}
    </nav>
    <div className="dashboard-account">
      <div className="dashboard-account-label"><span className="dashboard-account-avatar" aria-hidden="true">{(user?.displayName ?? 'PF').slice(0, 2).toUpperCase()}</span>
        <div><strong>{user?.displayName ?? 'Tài khoản'}</strong><span>{workspace}</span></div></div>
      <SessionControls />
    </div>
  </>
  return <>
    <aside id="dashboard-sidebar" className="dashboard-sidebar" hidden={collapsed}>{content(false)}</aside>
    <header className={'dashboard-toolbar' + (collapsed ? ' is-collapsed' : '')}>
      <button ref={trigger} type="button" className="dashboard-menu dashboard-icon-button"
        aria-label="Mở điều hướng" aria-expanded={open} aria-controls="dashboard-drawer" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>{collapsed && <button ref={reopenButton} type="button" className="dashboard-reopen dashboard-icon-button" aria-label="Mở thanh bên"
        title="Mở thanh bên" aria-controls="dashboard-sidebar" aria-expanded={false} onClick={toggleSidebar}><Icon name="sidebar" /></button>}
    </header>
    <dialog id="dashboard-drawer" ref={drawer} className="dashboard-drawer" aria-label={'Điều hướng ' + workspace.toLowerCase()}
      onCancel={event => { event.preventDefault(); close() }} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === drawer.current) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX > bounds.right) close() } }}>
      {open && content(true)}
    </dialog>
  </>
}
