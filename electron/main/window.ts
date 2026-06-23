import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { is } from './util'
import { IPC } from './shared-types'

const ICON_PATH = join(__dirname, '../../build/icon.png')

let isDirty = false

export function setDirtyState(dirty: boolean): void {
  isDirty = dirty
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('close', (event) => {
    if (!isDirty) return
    event.preventDefault()
    window.webContents.send(IPC.window.confirmClose)
  })

  const onCloseAccepted = (): void => {
    isDirty = false
    window.destroy()
  }
  ipcMain.on(IPC.window.closeAccepted, onCloseAccepted)
  window.on('closed', () => ipcMain.removeListener(IPC.window.closeAccepted, onCloseAccepted))

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.webContents.on('found-in-page', (_event, result) => {
    window.webContents.send(IPC.window.foundInPage, {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches
    })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
