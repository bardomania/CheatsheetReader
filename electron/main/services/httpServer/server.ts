import Fastify, { type FastifyInstance } from 'fastify'
import { registerRoutes } from './routes'
import { readExposureConfig } from '../exposureConfigStore'

let instance: FastifyInstance | null = null

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', 'localhost'])

export function isRunning(): boolean {
  return instance !== null
}

export async function startServer(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (instance) return { ok: true }

  const config = await readExposureConfig()
  const isLoopback = LOOPBACK_ADDRESSES.has(config.bindAddress)

  if (!config.vaultRoot) {
    return { ok: false, error: 'No vault configured. Open a vault and set it before starting the server.' }
  }

  // Hard rule, enforced here (not just in the UI): exposing beyond loopback
  // without an admin password configured is refused outright.
  if (!isLoopback && !config.passwordHash) {
    return { ok: false, error: 'Refusing to bind a non-loopback address without an admin password set.' }
  }

  const app = Fastify({ trustProxy: true })
  registerRoutes(app)

  try {
    await app.listen({ host: config.bindAddress, port: config.port })
    instance = app
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function stopServer(): Promise<void> {
  if (!instance) return
  await instance.close()
  instance = null
}

export async function getExposureWarning(): Promise<string | null> {
  const config = await readExposureConfig()
  const isLoopback = LOOPBACK_ADDRESSES.has(config.bindAddress)
  if (isRunning() && !isLoopback && !config.passwordHash) {
    return 'Exposed on a non-loopback address with no admin password set.'
  }
  return null
}
