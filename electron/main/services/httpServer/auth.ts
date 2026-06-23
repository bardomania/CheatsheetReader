import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h

interface Session {
  token: string
  expiresAt: number
}

const sessions = new Map<string, Session>()

export function createSession(): string {
  const token = randomUUID()
  sessions.set(token, { token, expiresAt: Date.now() + SESSION_TTL_MS })
  return token
}

export function isValidSession(token: string): boolean {
  const session = sessions.get(token)
  if (!session) return false
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

export function clearSessions(): void {
  sessions.clear()
}
