import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface AppConfig {
  lastVaultPath: string | null
}

const DEFAULT_CONFIG: AppConfig = { lastVaultPath: null }

function configFile(): string {
  return join(app.getPath('userData'), 'app-config.json')
}

async function readAppConfig(): Promise<AppConfig> {
  try {
    const content = await fs.readFile(configFile(), 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
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
