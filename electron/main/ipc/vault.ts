import { resolve } from 'path'
import { ipcMain } from 'electron'
import { IPC, type AttachmentFolderSettings } from '../shared-types'
import {
  pickFolder,
  getTree,
  readFile,
  writeFile,
  scanVariableUsage,
  createFile,
  createFolder,
  renamePath,
  movePath,
  duplicateFile,
  saveImage
} from '../services/vaultService'
import { updateRefs } from '../services/refUpdateService'
import { softDelete, listTrash, restoreFromTrash, purgeFromTrash } from '../services/trashService'
import { listTemplates, getTemplateContent } from '../services/templateService'
import { searchVault } from '../services/searchService'
import {
  readVariables,
  writeVariables,
  listContexts,
  saveContext,
  deleteContext,
  exportVariablesJson,
  importVariablesJson,
  readVaultSettings,
  writeVaultSettings,
  type VaultSettings
} from '../services/configStore'
import { setDirtyState } from '../window'
import { getLastVaultPath, setLastVaultPath } from '../services/appConfigStore'
import { setActiveVaultRoot, getActiveVaultRoot } from '../services/activeVaultStore'
import { isWithinVault } from '../services/httpServer/pathGuard'

// Every path the renderer sends us ultimately traces back to user content —
// a wikilink, a canvas file-node, a search result — not just direct user
// input. Clamp every filesystem-touching call to the vault that's actually
// open, the same way the (separately sandboxed) HTTP exposure server already
// clamps its own requests via pathGuard.ts.
function assertWithinVault(candidate: string): void {
  const root = getActiveVaultRoot()
  if (!root || !isWithinVault(root, candidate)) {
    throw new Error('Refusing to access a path outside the open vault')
  }
}

function assertIsActiveRoot(rootPath: string): void {
  const root = getActiveVaultRoot()
  if (!root || resolve(rootPath) !== resolve(root)) {
    throw new Error('Refusing to act on a vault that is not the one currently open')
  }
}

export function registerVaultIpc(): void {
  ipcMain.handle(IPC.vault.pickFolder, async () => {
    const path = await pickFolder()
    return { path }
  })

  ipcMain.handle(IPC.vault.getTree, async (_event, rootPath: string) => {
    setActiveVaultRoot(rootPath)
    return getTree(rootPath)
  })

  ipcMain.handle(IPC.vault.createFile, async (_event, parentDirPath: string, name: string, content?: string) => {
    assertWithinVault(parentDirPath)
    return createFile(parentDirPath, name, content)
  })

  ipcMain.handle(IPC.vault.createFolder, async (_event, parentDirPath: string, name: string) => {
    assertWithinVault(parentDirPath)
    return createFolder(parentDirPath, name)
  })

  ipcMain.handle(IPC.vault.rename, async (_event, oldPath: string, newName: string, type: 'file' | 'folder') => {
    assertWithinVault(oldPath)
    return renamePath(oldPath, newName, type)
  })

  ipcMain.handle(IPC.vault.move, async (_event, sourcePath: string, destDirPath: string) => {
    assertWithinVault(sourcePath)
    assertWithinVault(destDirPath)
    return movePath(sourcePath, destDirPath)
  })

  ipcMain.handle(IPC.vault.duplicate, async (_event, filePath: string) => {
    assertWithinVault(filePath)
    return duplicateFile(filePath)
  })

  ipcMain.handle(IPC.vault.softDelete, async (_event, rootPath: string, itemPath: string, type: 'file' | 'folder') => {
    assertIsActiveRoot(rootPath)
    assertWithinVault(itemPath)
    return softDelete(rootPath, itemPath, type)
  })

  ipcMain.handle(
    IPC.vault.saveImage,
    async (
      _event,
      noteFilePath: string,
      base64Data: string,
      ext: string,
      vaultRoot: string,
      settings: AttachmentFolderSettings
    ) => {
      assertIsActiveRoot(vaultRoot)
      assertWithinVault(noteFilePath)
      return saveImage(noteFilePath, base64Data, ext, vaultRoot, settings)
    }
  )

  ipcMain.handle(IPC.vault.getLastVaultPath, async () => {
    return getLastVaultPath()
  })

  ipcMain.handle(IPC.vault.setLastVaultPath, async (_event, vaultPath: string | null) => {
    await setLastVaultPath(vaultPath)
  })

  ipcMain.handle(IPC.vault.updateRefs, async (_event, vaultRoot: string, oldPath: string, newPath: string) => {
    assertIsActiveRoot(vaultRoot)
    assertWithinVault(newPath)
    const { changedFiles } = await updateRefs(vaultRoot, oldPath, newPath)
    return changedFiles
  })

  ipcMain.handle(IPC.trash.list, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return listTrash(rootPath)
  })

  ipcMain.handle(IPC.trash.restore, async (_event, rootPath: string, id: string) => {
    assertIsActiveRoot(rootPath)
    return restoreFromTrash(rootPath, id)
  })

  ipcMain.handle(IPC.trash.purge, async (_event, rootPath: string, id: string) => {
    assertIsActiveRoot(rootPath)
    await purgeFromTrash(rootPath, id)
  })

  ipcMain.handle(IPC.templates.list, async () => {
    return listTemplates()
  })

  ipcMain.handle(IPC.templates.getContent, async (_event, name: string) => {
    return getTemplateContent(name)
  })

  ipcMain.handle(IPC.search.query, async (_event, rootPath: string, query: string, mode: 'all' | 'code') => {
    assertIsActiveRoot(rootPath)
    return searchVault(rootPath, query, mode)
  })

  ipcMain.handle(IPC.file.read, async (_event, filePath: string) => {
    assertWithinVault(filePath)
    return readFile(filePath)
  })

  ipcMain.handle(IPC.file.write, async (_event, filePath: string, content: string) => {
    assertWithinVault(filePath)
    await writeFile(filePath, content)
  })

  ipcMain.handle(IPC.vaultSettings.read, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return readVaultSettings(rootPath)
  })

  ipcMain.handle(IPC.vaultSettings.write, async (_event, rootPath: string, settings: VaultSettings) => {
    assertIsActiveRoot(rootPath)
    await writeVaultSettings(rootPath, settings)
  })

  ipcMain.on(IPC.editor.setDirty, (_event, isDirty: boolean) => {
    setDirtyState(isDirty)
  })

  ipcMain.handle(IPC.variables.scanUsage, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return scanVariableUsage(rootPath)
  })

  ipcMain.handle(IPC.variables.loadPersisted, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return { values: await readVariables(rootPath), contexts: await listContexts(rootPath) }
  })

  ipcMain.handle(IPC.variables.persistValues, async (_event, rootPath: string, values: Record<string, string>) => {
    assertIsActiveRoot(rootPath)
    await writeVariables(rootPath, values)
  })

  ipcMain.handle(IPC.variables.saveContext, async (_event, rootPath: string, name: string, values: Record<string, string>) => {
    assertIsActiveRoot(rootPath)
    return saveContext(rootPath, name, values)
  })

  ipcMain.handle(IPC.variables.deleteContext, async (_event, rootPath: string, name: string) => {
    assertIsActiveRoot(rootPath)
    await deleteContext(rootPath, name)
  })

  ipcMain.handle(IPC.variables.exportJson, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return exportVariablesJson(rootPath)
  })

  ipcMain.handle(IPC.variables.importJson, async (_event, rootPath: string) => {
    assertIsActiveRoot(rootPath)
    return importVariablesJson(rootPath)
  })
}
