export const DEMO_CREDENTIALS = {
  username: 'Demo@grelinhealth.com',
  password: 'Grelin@2026!!',
}

const SESSION_KEY = 'rcm-ai-session'

export function login(username: string, password: string): boolean {
  const ok =
    username.trim().toLowerCase() === DEMO_CREDENTIALS.username.toLowerCase() &&
    password === DEMO_CREDENTIALS.password

  if (ok) {
    sessionStorage.setItem(SESSION_KEY, username)
  }
  return ok
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function getSession(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}
