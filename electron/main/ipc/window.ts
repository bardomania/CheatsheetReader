import { ipcMain, BrowserWindow } from 'electron'
import { IPC, type FindInPageOptions } from '../shared-types'
import { getGlobalToggleShortcut, setGlobalToggleShortcut } from '../services/appConfigStore'
import { registerToggleShortcut } from '../services/globalToggleShortcut'

export function registerWindowIpc(): void {
  ipcMain.on(IPC.window.findInPage, (event, text: string, options?: FindInPageOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!text) {
      win?.webContents.stopFindInPage('clearSelection')
      return
    }
    win?.webContents.findInPage(text, options)
  })

  ipcMain.on(IPC.window.stopFindInPage, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.stopFindInPage('clearSelection')
  })

  ipcMain.handle(IPC.window.getToggleShortcut, () => getGlobalToggleShortcut())

  ipcMain.handle(IPC.window.setToggleShortcut, async (event, accelerator: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false, error: 'No active window' }
    const ok = registerToggleShortcut(accelerator, win)
    if (!ok) return { ok: false, error: 'This shortcut is invalid or already used by another app' }
    await setGlobalToggleShortcut(accelerator)
    return { ok: true }
  })
}
