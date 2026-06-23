import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { getActiveVaultRoot } from './services/activeVaultStore'
import { isWithinVault } from './services/httpServer/pathGuard'

export const VAULT_ASSET_SCHEME = 'app'

export function registerVaultAssetSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: VAULT_ASSET_SCHEME,
      privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

// Serves local vault files via app://vault-asset/<absolute-path>, so the renderer
// can reference images by absolute disk path without relaxing CSP to file://.
export function registerVaultAssetProtocol(): void {
  protocol.handle(VAULT_ASSET_SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.host !== 'vault-asset') {
      return new Response('Not found', { status: 404 })
    }
    const decodedPath = decodeURIComponent(url.pathname.slice(1))

    const vaultRoot = getActiveVaultRoot()
    if (!vaultRoot || !isWithinVault(vaultRoot, decodedPath)) {
      return new Response('Forbidden', { status: 403 })
    }

    return net.fetch(pathToFileURL(decodedPath).toString())
  })
}
