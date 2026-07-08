import { useState } from 'react'
import LoginPage from './LoginPage'
import Dashboard from './Dashboard'
import { getSession, logout } from './auth'
import { resetEligibilitySession } from './modules/eligibility/api/patientsApi'
import { resetPriorAuthSession } from './modules/priorauth/dashboard/caseStore'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getSession()))

  const handleLogout = () => {
    resetEligibilitySession()
    resetPriorAuthSession()
    logout()
    setIsAuthenticated(false)
  }

  return isAuthenticated ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={() => setIsAuthenticated(true)} />
  )
}

export default App
