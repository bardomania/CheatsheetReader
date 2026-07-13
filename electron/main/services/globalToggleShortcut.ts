import { BrowserWindow, globalShortcut } from 'electron'

let registeredAccelerator: string | null = null

function toggleWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  if (window.isVisible() && !window.isMinimized()) {
    window.hide()
    return
  }
  if (window.isMinimized()) window.restore()
  window.center()
  window.show()
  window.focus()
}

export function registerToggleShortcut(accelerator: string, window: BrowserWindow): boolean {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
  const ok = globalShortcut.register(accelerator, () => toggleWindow(window))
  if (ok) registeredAccelerator = accelerator
  return ok
}

export function unregisterToggleShortcut(): void {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
}
