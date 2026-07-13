import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface VaultHistoryEntry {
  path: string
  lastOpened: string
}

export interface VaultSession {
  openTabs: string[]
  activeTabPath: string | null
}

export interface AppConfig {
  lastVaultPath: string | null
  recentVaults: VaultHistoryEntry[]
  vaultSessions: Record<string, VaultSession>
  globalToggleShortcut: string
}

const DEFAULT_TOGGLE_SHORTCUT = 'CommandOrControl+Shift+Space'

const DEFAULT_CONFIG: AppConfig = {
  lastVaultPath: null,
  recentVaults: [],
  vaultSessions: {},
  globalToggleShortcut: DEFAULT_TOGGLE_SHORTCUT
}

function configFile(): string {
  return join(app.getPath('userData'), 'app-config.json')
}

async function readAppConfig(): Promise<AppConfig> {
  try {
    const content = await fs.readFile(configFile(), 'utf-8')
    const parsed = JSON.parse(content)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_CONFIG }
    throw err
  }
}

async function writeAppConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2), 'utf-8')
}

// Obsidian-style "always reopen the last vault" — validated against disk so a
// moved/deleted vault doesn't get silently retried forever on every launch.
export async function getLastVaultPath(): Promise<string | null> {
  const config = await readAppConfig()
  if (!config.lastVaultPath) return null
  try {
    const stat = await fs.stat(config.lastVaultPath)
    return stat.isDirectory() ? config.lastVaultPath : null
  } catch {
    return null
  }
}

export async function setLastVaultPath(vaultPath: string | null): Promise<void> {
  const config = await readAppConfig()
  await writeAppConfig({ ...config, lastVaultPath: vaultPath })
}

export async function addToRecentVaults(vaultPath: string): Promise<void> {
  const config = await readAppConfig()
  const filtered = (config.recentVaults ?? []).filter((v) => v.path !== vaultPath)
  const updated = [{ path: vaultPath, lastOpened: new Date().toISOString() }, ...filtered].slice(0, 20)
  await writeAppConfig({ ...config, recentVaults: updated })
}

export async function removeFromRecentVaults(vaultPath: string): Promise<void> {
  const config = await readAppConfig()
  const updated = (config.recentVaults ?? []).filter((v) => v.path !== vaultPath)
  await writeAppConfig({ ...config, recentVaults: updated })
}

export async function getRecentVaults(): Promise<VaultHistoryEntry[]> {
  const config = await readAppConfig()
  return config.recentVaults ?? []
}

export async function saveVaultSession(vaultPath: string, session: VaultSession): Promise<void> {
  const config = await readAppConfig()
  const sessions = { ...(config.vaultSessions ?? {}), [vaultPath]: session }
  await writeAppConfig({ ...config, vaultSessions: sessions })
}

export async function getVaultSession(vaultPath: string): Promise<VaultSession | null> {
  const config = await readAppConfig()
  return (config.vaultSessions ?? {})[vaultPath] ?? null
}

export async function getGlobalToggleShortcut(): Promise<string> {
  const config = await readAppConfig()
  return config.globalToggleShortcut ?? DEFAULT_TOGGLE_SHORTCUT
}

export async function setGlobalToggleShortcut(accelerator: string): Promise<void> {
  const config = await readAppConfig()
  await writeAppConfig({ ...config, globalToggleShortcut: accelerator })
}
