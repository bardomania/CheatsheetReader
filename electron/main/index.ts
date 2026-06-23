import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { registerVaultIpc } from './ipc/vault'
import { registerExposureIpc } from './ipc/exposure'
import { registerWindowIpc } from './ipc/window'
import { registerVaultAssetSchemePrivileges, registerVaultAssetProtocol } from './protocol'
import { stopServer } from './services/httpServer/server'

registerVaultAssetSchemePrivileges()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    registerVaultAssetProtocol()
    registerVaultIpc()
    registerExposureIpc()
    registerWindowIpc()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    stopServer()
  })
}
