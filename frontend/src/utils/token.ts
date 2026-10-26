const TOKEN_KEY = 'kb_token'
const USERNAME_KEY = 'kb_remember_username'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getRememberedUsername(): string {
  return localStorage.getItem(USERNAME_KEY) ?? ''
}

export function setRememberedUsername(username: string): void {
  if (username) {
    localStorage.setItem(USERNAME_KEY, username)
    return
  }
  localStorage.removeItem(USERNAME_KEY)
}
