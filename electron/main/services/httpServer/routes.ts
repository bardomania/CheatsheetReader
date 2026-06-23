import type { FastifyInstance } from 'fastify'
import { getTree, readFile, writeFile } from '../vaultService'
import { readVariables } from '../configStore'
import { verifyPassword, createSession, isValidSession } from './auth'
import { readExposureConfig } from '../exposureConfigStore'
import { resolveWithinVault } from './pathGuard'

const PUBLIC_PATHS = new Set(['/health', '/auth/login'])

export function registerRoutes(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    if (PUBLIC_PATHS.has(request.url.split('?')[0])) return

    const config = await readExposureConfig()
    const authHeader = request.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    const validSession = token ? isValidSession(token) : false
    const validBearer = token && config.bearerToken ? token === config.bearerToken : false

    if (!validSession && !validBearer) {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.get('/health', async () => ({ status: 'ok' }))

  app.post<{ Body: { password: string } }>('/auth/login', async (request, reply) => {
    const config = await readExposureConfig()
    if (!config.passwordHash) {
      reply.code(403).send({ error: 'No admin password configured' })
      return
    }
    const ok = await verifyPassword(request.body.password, config.passwordHash)
    if (!ok) {
      reply.code(401).send({ error: 'Invalid password' })
      return
    }
    return { token: createSession() }
  })

  // None of the routes below trust a client-supplied root/path on its own:
  // the server only ever operates on the single vault configured locally
  // (config.vaultRoot), and any sub-path the client asks for is clamped to
  // stay inside it via resolveWithinVault. This is what stops an
  // authenticated-but-malicious client from reading/writing elsewhere on
  // disk via "../../" or an absolute path in the query string.

  app.get('/api/tree', async (_request, reply) => {
    const config = await readExposureConfig()
    if (!config.vaultRoot) {
      reply.code(409).send({ error: 'No vault configured for this server' })
      return
    }
    return getTree(config.vaultRoot)
  })

  app.get<{ Querystring: { path: string } }>('/api/file', async (request, reply) => {
    const config = await readExposureConfig()
    if (!config.vaultRoot) {
      reply.code(409).send({ error: 'No vault configured for this server' })
      return
    }
    const resolved = resolveWithinVault(config.vaultRoot, request.query.path)
    if (!resolved) {
      reply.code(400).send({ error: 'Path is outside the configured vault' })
      return
    }
    const content = await readFile(resolved)
    return { content }
  })

  app.put<{ Querystring: { path: string }; Body: { content: string } }>('/api/file', async (request, reply) => {
    const config = await readExposureConfig()
    if (!config.vaultRoot) {
      reply.code(409).send({ error: 'No vault configured for this server' })
      return
    }
    const resolved = resolveWithinVault(config.vaultRoot, request.query.path)
    if (!resolved) {
      reply.code(400).send({ error: 'Path is outside the configured vault' })
      return
    }
    await writeFile(resolved, request.body.content)
    return { ok: true }
  })

  app.get('/api/variables', async (_request, reply) => {
    const config = await readExposureConfig()
    if (!config.vaultRoot) {
      reply.code(409).send({ error: 'No vault configured for this server' })
      return
    }
    return readVariables(config.vaultRoot)
  })
}
