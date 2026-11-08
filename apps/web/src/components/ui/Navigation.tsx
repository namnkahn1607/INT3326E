import { NavLink } from 'react-router'

export interface NavigationItem {
  path: string
  label: string
  badge?: string | number
}

interface NavigationProps {
  items: NavigationItem[]
  className?: string
  linkClassName?: string
}

export function Navigation({
  items,
  className = '',
  linkClassName = 'nav-item',
}: NavigationProps) {
  return (
    <nav className={className} aria-label="Điều hướng">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          className={({ isActive }) =>
            isActive ? `${linkClassName} active` : linkClassName
          }
        >
          <span>{item.label}</span>
          {item.badge !== undefined && (
            <span className="nav-badge">{item.badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
