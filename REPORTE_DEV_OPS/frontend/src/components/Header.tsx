import type { FC } from 'react'

interface Props {
  appName?: string
}

const Header: FC<Props> = ({ appName = 'Reporte DevOps' }) => (
  <header className="app-header">
    <div className="header-logo">
      <span className="logo-badge">CFO</span>
      <span className="header-brand">
        <span className="header-brand-main">CFOTech</span>
        <span className="header-brand-sub">IT Tools</span>
      </span>
    </div>
    <span className="header-app-name">{appName}</span>
  </header>
)

export default Header
