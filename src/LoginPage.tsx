import { useState, type FormEvent } from 'react'
import logo from './assets/grelin-logo.png'
import { DEMO_CREDENTIALS, login } from './auth'
import './LoginPage.css'

interface LoginPageProps {
  onLogin: () => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Please enter both username and password to continue.')
      return
    }

    setIsSubmitting(true)

    window.setTimeout(() => {
      const success = login(username, password)
      if (success) {
        onLogin()
      } else {
        setError('Invalid credentials. Please check your username and password.')
        setIsSubmitting(false)
      }
    }, 600)
  }

  const useUsername = () => {
    setUsername(DEMO_CREDENTIALS.username)
    setError('')
  }

  const usePassword = () => {
    setPassword(DEMO_CREDENTIALS.password)
    setError('')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="accent-bar" aria-hidden="true" />

        <div className="brand-block">
          <img src={logo} alt="Grelin" className="brand-logo" />
          <h1>AI Powered End to End RCM Solutions</h1>
          <div className="powered-row">
            <span className="powered-line" aria-hidden="true" />
            <span className="powered-text">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
              </svg>
              Powered by Grelin AI
            </span>
            <span className="powered-line" aria-hidden="true" />
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4 6.5l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                  <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 10.5V7.5a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
                    <path d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.6 3.5M7.4 7.6C5.2 9 3.7 11 3 12c1.6 3 5.1 6.5 9 6.5 1.5 0 2.9-.4 4.2-1.1M12 5.5c4 0 7.5 3.5 9 6.5-.5 1-1.4 2.3-2.6 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
                    <path d="M3 12s3.5-6.5 9-6.5 9 6.5 9 6.5-3.5 6.5-9 6.5-9-6.5-9-6.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Authenticating...
              </>
            ) : (
              'Sign In to System'
            )}
          </button>
        </form>

        <div className="hipaa-row">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
            <path
              d="M12 2l7 3v6c0 4.97-3.05 9.28-7 10.5-3.95-1.22-7-5.53-7-10.5V5l7-3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          HIPAA Secured &amp; Compliant
        </div>

        <div className="section-divider" />

        <div className="demo-heading-row">
          <span className="powered-line" aria-hidden="true" />
          <span className="demo-heading">Demo Access</span>
          <span className="powered-line" aria-hidden="true" />
        </div>

        <div className="demo-list">
          <button type="button" className="demo-row" onClick={useUsername}>
            <span className="demo-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M4 6.5l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="demo-row-text">
              <span className="demo-row-label">Username</span>
              <span className="demo-row-value">{DEMO_CREDENTIALS.username}</span>
            </span>
            <span className="use-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
                <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M4 16V6a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Use
            </span>
          </button>

          <button type="button" className="demo-row" onClick={usePassword}>
            <span className="demo-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M8 10.5V7.5a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="demo-row-text">
              <span className="demo-row-label">Password</span>
              <span className="demo-row-value">{DEMO_CREDENTIALS.password}</span>
            </span>
            <span className="use-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
                <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M4 16V6a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Use
            </span>
          </button>
        </div>

        <p className="demo-caption">Click either row above to auto-fill credentials</p>
      </div>

      <p className="page-footer">&copy; 2026 Grelin Health Inc. All rights reserved.</p>
    </div>
  )
}

export default LoginPage
