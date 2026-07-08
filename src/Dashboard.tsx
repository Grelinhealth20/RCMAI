import { useState } from 'react'
import logo from './assets/grelin-logo.png'
import { modules } from './modules/registry'
import './Dashboard.css'

interface DashboardProps {
  onLogout: () => void
}

function Dashboard({ onLogout }: DashboardProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)

  const handleLogout = () => {
    setIsLoggingOut(true)
    window.setTimeout(() => {
      onLogout()
    }, 400)
  }

  const activeModule = modules.find((m) => m.id === activeModuleId) ?? null
  const ActiveComponent = activeModule?.Component ?? null

  return (
    <div className="dashboard">
      <div className="app-shell">
        <header className="dashboard-header">
          <div className="header-brand">
            <span className="logo-frame">
              <img src={logo} alt="Grelin" className="header-logo" />
            </span>
            <span className="header-brand-text">
              <span className="header-title">{activeModule ? activeModule.name : 'RCM AI'}</span>
              <span className="header-subtitle">Powered By Grelin AI</span>
            </span>
          </div>

          <div className="header-right">
            <span className="status-pill">
              <span className="live-dot" aria-hidden="true" />
              System Online
            </span>
            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Signing Out...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                    <path
                      d="M15 17l5-5-5-5M20 12H9M12 19H7a2 2 0 01-2-2V7a2 2 0 012-2h5"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Logout
                </>
              )}
            </button>
          </div>
        </header>

        <div className="shell-body">
          <aside className={`sidebar${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((v) => !v)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isSidebarCollapsed}
            >
              <svg
                className="sidebar-toggle-icon"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                aria-hidden="true"
              >
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {!isSidebarCollapsed && <div className="sidebar-label">AI Modules</div>}

            <nav className="sidebar-nav">
              {modules.map((module) => {
                const Icon = module.icon
                const isActive = module.id === activeModuleId
                return (
                  <button
                    key={module.id}
                    type="button"
                    className={`sidebar-nav-item${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveModuleId(isActive ? null : module.id)}
                    title={module.name}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="sidebar-nav-icon">
                      <Icon />
                    </span>
                    {!isSidebarCollapsed && <span className="sidebar-nav-label">{module.name}</span>}
                    {isActive && <span className="sidebar-nav-indicator" aria-hidden="true" />}
                  </button>
                )
              })}
            </nav>
          </aside>

          <main className="dashboard-body">
            {ActiveComponent ? <ActiveComponent /> : <div className="dashboard-body-blank" />}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
