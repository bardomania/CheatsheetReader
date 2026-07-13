import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ElectronApi } from '../main/shared-types'

const api: ElectronApi = {
  vault: {
    pickFolder: () => ipcRenderer.invoke(IPC.vault.pickFolder),
    getTree: (rootPath) => ipcRenderer.invoke(IPC.vault.getTree, rootPath),
    createFile: (parentDirPath, name, content) =>
      ipcRenderer.invoke(IPC.vault.createFile, parentDirPath, name, content),
    createFolder: (parentDirPath, name) => ipcRenderer.invoke(IPC.vault.createFolder, parentDirPath, name),
    rename: (oldPath, newName, type) => ipcRenderer.invoke(IPC.vault.rename, oldPath, newName, type),
    move: (sourcePath, destDirPath) => ipcRenderer.invoke(IPC.vault.move, sourcePath, destDirPath),
    duplicate: (filePath) => ipcRenderer.invoke(IPC.vault.duplicate, filePath),
    softDelete: (rootPath, itemPath, type) => ipcRenderer.invoke(IPC.vault.softDelete, rootPath, itemPath, type),
    saveImage: (noteFilePath, base64Data, ext, vaultRoot, settings) =>
      ipcRenderer.invoke(IPC.vault.saveImage, noteFilePath, base64Data, ext, vaultRoot, settings),
    getLastVaultPath: () => ipcRenderer.invoke(IPC.vault.getLastVaultPath),
    setLastVaultPath: (vaultPath) => ipcRenderer.invoke(IPC.vault.setLastVaultPath, vaultPath),
    updateRefs: (vaultRoot, oldPath, newPath) =>
      ipcRenderer.invoke(IPC.vault.updateRefs, vaultRoot, oldPath, newPath),
    listRecent: () => ipcRenderer.invoke(IPC.vault.listRecent),
    removeRecent: (path) => ipcRenderer.invoke(IPC.vault.removeRecent, path),
    saveSession: (vaultPath, session) => ipcRenderer.invoke(IPC.vault.saveSession, vaultPath, session),
    getSession: (vaultPath) => ipcRenderer.invoke(IPC.vault.getSession, vaultPath)
  },
  trash: {
    list: (rootPath) => ipcRenderer.invoke(IPC.trash.list, rootPath),
    restore: (rootPath, id) => ipcRenderer.invoke(IPC.trash.restore, rootPath, id),
    purge: (rootPath, id) => ipcRenderer.invoke(IPC.trash.purge, rootPath, id)
  },
  templates: {
    list: () => ipcRenderer.invoke(IPC.templates.list),
    getContent: (name) => ipcRenderer.invoke(IPC.templates.getContent, name)
  },
  search: {
    query: (rootPath, query, mode) => ipcRenderer.invoke(IPC.search.query, rootPath, query, mode)
  },
  exposure: {
    getStatus: () => ipcRenderer.invoke(IPC.exposure.getStatus),
    setPassword: (password) => ipcRenderer.invoke(IPC.exposure.setPassword, password),
    setBearerToken: (token) => ipcRenderer.invoke(IPC.exposure.setBearerToken, token),
    setBindConfig: (bindAddress, port) => ipcRenderer.invoke(IPC.exposure.setBindConfig, bindAddress, port),
    setVaultRoot: (rootPath) => ipcRenderer.invoke(IPC.exposure.setVaultRoot, rootPath),
    start: () => ipcRenderer.invoke(IPC.exposure.start),
    stop: () => ipcRenderer.invoke(IPC.exposure.stop)
  },
  file: {
    read: (filePath) => ipcRenderer.invoke(IPC.file.read, filePath),
    write: (filePath, content) => ipcRenderer.invoke(IPC.file.write, filePath, content)
  },
  vaultSettings: {
    read: (rootPath) => ipcRenderer.invoke(IPC.vaultSettings.read, rootPath),
    write: (rootPath, settings) => ipcRenderer.invoke(IPC.vaultSettings.write, rootPath, settings)
  },
  editor: {
    setDirty: (isDirty) => ipcRenderer.send(IPC.editor.setDirty, isDirty)
  },
  window: {
    findInPage: (text, options) => ipcRenderer.send(IPC.window.findInPage, text, options),
    stopFindInPage: () => ipcRenderer.send(IPC.window.stopFindInPage),
    onFindResult: (callback) => {
      const listener = (_event: unknown, result: { activeMatchOrdinal: number; matches: number }): void =>
        callback(result)
      ipcRenderer.on(IPC.window.foundInPage, listener)
      return () => ipcRenderer.removeListener(IPC.window.foundInPage, listener)
    },
    onConfirmClose: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC.window.confirmClose, listener)
      return () => ipcRenderer.removeListener(IPC.window.confirmClose, listener)
    },
    confirmCloseAccepted: () => ipcRenderer.send(IPC.window.closeAccepted),
    getToggleShortcut: () => ipcRenderer.invoke(IPC.window.getToggleShortcut),
    setToggleShortcut: (accelerator) => ipcRenderer.invoke(IPC.window.setToggleShortcut, accelerator)
  },
  variables: {
    scanUsage: (rootPath) => ipcRenderer.invoke(IPC.variables.scanUsage, rootPath),
    loadPersisted: (rootPath) => ipcRenderer.invoke(IPC.variables.loadPersisted, rootPath),
    persistValues: (rootPath, values) => ipcRenderer.invoke(IPC.variables.persistValues, rootPath, values),
    saveContext: (rootPath, name, values) => ipcRenderer.invoke(IPC.variables.saveContext, rootPath, name, values),
    deleteContext: (rootPath, name) => ipcRenderer.invoke(IPC.variables.deleteContext, rootPath, name),
    exportJson: (rootPath) => ipcRenderer.invoke(IPC.variables.exportJson, rootPath),
    importJson: (rootPath) => ipcRenderer.invoke(IPC.variables.importJson, rootPath),
    readMeta: (rootPath) => ipcRenderer.invoke(IPC.variables.readMeta, rootPath),
    writeMeta: (rootPath, meta) => ipcRenderer.invoke(IPC.variables.writeMeta, rootPath, meta)
  }
}

contextBridge.exposeInMainWorld('api', api)
