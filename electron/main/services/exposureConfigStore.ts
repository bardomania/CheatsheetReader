import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface ExposureConfig {
  bindAddress: string
  port: number
  passwordHash: string | null
  bearerToken: string | null
  // The single vault the HTTP server is allowed to read/write. All routes
  // must clamp client-supplied paths to within this directory — never trust
  // a root/path query param on its own, since the server is reachable from
  // outside the desktop session once exposure is enabled.
  vaultRoot: string | null
}

const DEFAULT_CONFIG: ExposureConfig = {
  bindAddress: '127.0.0.1',
  port: 4756,
  passwordHash: null,
  bearerToken: null,
  vaultRoot: null
}

function configFile(): string {
  return join(app.getPath('userData'), 'exposure-config.json')
}

export async function readExposureConfig(): Promise<ExposureConfig> {
  try {
    const content = await fs.readFile(configFile(), 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_CONFIG }
    throw err
  }
}

export async function writeExposureConfig(config: ExposureConfig): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2), 'utf-8')
}
