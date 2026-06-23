import { ipcMain, BrowserWindow } from 'electron'
import { IPC, type FindInPageOptions } from '../shared-types'

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
}
