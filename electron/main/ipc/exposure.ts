import { ipcMain } from 'electron'
import { IPC } from '../shared-types'
import { readExposureConfig, writeExposureConfig } from '../services/exposureConfigStore'
import { hashPassword } from '../services/httpServer/auth'
import { startServer, stopServer, isRunning, getExposureWarning } from '../services/httpServer/server'

export function registerExposureIpc(): void {
  ipcMain.handle(IPC.exposure.getStatus, async () => {
    const config = await readExposureConfig()
    return {
      running: isRunning(),
      bindAddress: config.bindAddress,
      port: config.port,
      hasPassword: !!config.passwordHash,
      hasBearerToken: !!config.bearerToken,
      vaultRoot: config.vaultRoot,
      warning: await getExposureWarning()
    }
  })

  ipcMain.handle(IPC.exposure.setPassword, async (_event, password: string) => {
    const config = await readExposureConfig()
    config.passwordHash = await hashPassword(password)
    await writeExposureConfig(config)
  })

  ipcMain.handle(IPC.exposure.setBearerToken, async (_event, token: string | null) => {
    const config = await readExposureConfig()
    config.bearerToken = token
    await writeExposureConfig(config)
  })

  ipcMain.handle(IPC.exposure.setBindConfig, async (_event, bindAddress: string, port: number) => {
    const config = await readExposureConfig()
    config.bindAddress = bindAddress
    config.port = port
    await writeExposureConfig(config)
  })

  ipcMain.handle(IPC.exposure.setVaultRoot, async (_event, rootPath: string) => {
    const config = await readExposureConfig()
    config.vaultRoot = rootPath
    await writeExposureConfig(config)
  })

  ipcMain.handle(IPC.exposure.start, async () => {
    return startServer()
  })

  ipcMain.handle(IPC.exposure.stop, async () => {
    await stopServer()
  })
}
