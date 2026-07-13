export const IPC = {
  vault: {
    pickFolder: 'vault:pickFolder',
    getTree: 'vault:getTree',
    createFile: 'vault:createFile',
    createFolder: 'vault:createFolder',
    rename: 'vault:rename',
    move: 'vault:move',
    duplicate: 'vault:duplicate',
    softDelete: 'vault:softDelete',
    saveImage: 'vault:saveImage',
    getLastVaultPath: 'vault:getLastVaultPath',
    setLastVaultPath: 'vault:setLastVaultPath',
    updateRefs: 'vault:updateRefs',
    listRecent: 'vault:listRecent',
    removeRecent: 'vault:removeRecent',
    saveSession: 'vault:saveSession',
    getSession: 'vault:getSession'
  },
  trash: {
    list: 'trash:list',
    restore: 'trash:restore',
    purge: 'trash:purge'
  },
  templates: {
    list: 'templates:list',
    getContent: 'templates:getContent'
  },
  search: {
    query: 'search:query'
  },
  exposure: {
    getStatus: 'exposure:getStatus',
    setPassword: 'exposure:setPassword',
    setBearerToken: 'exposure:setBearerToken',
    setBindConfig: 'exposure:setBindConfig',
    setVaultRoot: 'exposure:setVaultRoot',
    start: 'exposure:start',
    stop: 'exposure:stop'
  },
  file: {
    read: 'file:read',
    write: 'file:write'
  },
  vaultSettings: {
    read: 'vaultSettings:read',
    write: 'vaultSettings:write'
  },
  editor: {
    setDirty: 'editor:setDirty'
  },
  window: {
    findInPage: 'window:findInPage',
    stopFindInPage: 'window:stopFindInPage',
    foundInPage: 'window:foundInPage',
    confirmClose: 'window:confirmClose',
    closeAccepted: 'window:closeAccepted',
    getToggleShortcut: 'window:getToggleShortcut',
    setToggleShortcut: 'window:setToggleShortcut'
  },
  variables: {
    scanUsage: 'variables:scanUsage',
    loadPersisted: 'variables:loadPersisted',
    persistValues: 'variables:persistValues',
    saveContext: 'variables:saveContext',
    deleteContext: 'variables:deleteContext',
    exportJson: 'variables:exportJson',
    importJson: 'variables:importJson',
    readMeta: 'variables:readMeta',
    writeMeta: 'variables:writeMeta'
  }
} as const

export interface VaultHistoryEntry {
  path: string
  lastOpened: string
}

export interface VaultSession {
  openTabs: string[]
  activeTabPath: string | null
}

export interface VaultTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: VaultTreeNode[]
}

export interface PickFolderResult {
  path: string | null
}

export interface GetTreeResult {
  root: string
  tree: VaultTreeNode[]
}

export interface VariableContext {
  name: string
  values: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface VariablesMeta {
  order: string[]
  presets: Record<string, string[]>
}

export interface VariablesExport {
  values: Record<string, string>
  contexts: VariableContext[]
}

export type AttachmentFolderMode = 'vault-folder' | 'fixed-folder' | 'same-folder' | 'subfolder'

export interface AttachmentFolderSettings {
  mode: AttachmentFolderMode
  folderName: string
}

export interface VaultSettings {
  autosaveEnabled: boolean
  autosaveIntervalMs: number
  attachmentFolder: AttachmentFolderSettings
  activeContext: string
}

export interface SaveImageResult {
  absolutePath: string
  relativeFromNote: string
}

export interface FindInPageResult {
  activeMatchOrdinal: number
  matches: number
}

export interface FindInPageOptions {
  forward?: boolean
  findNext?: boolean
  matchCase?: boolean
}

export interface SetToggleShortcutResult {
  ok: boolean
  error?: string
}

export interface ExposureStatus {
  running: boolean
  bindAddress: string
  port: number
  hasPassword: boolean
  hasBearerToken: boolean
  vaultRoot: string | null
  warning: string | null
}

export interface SearchResult {
  filePath: string
  name: string
  snippet?: string
}

export interface TrashManifest {
  id: string
  originalPath: string
  name: string
  type: 'file' | 'folder'
  deletedAt: string
}

export interface ElectronApi {
  vault: {
    pickFolder: () => Promise<PickFolderResult>
    getTree: (rootPath: string) => Promise<VaultTreeNode[]>
    createFile: (parentDirPath: string, name: string, content?: string) => Promise<string>
    createFolder: (parentDirPath: string, name: string) => Promise<string>
    rename: (oldPath: string, newName: string, type: 'file' | 'folder') => Promise<string>
    move: (sourcePath: string, destDirPath: string) => Promise<string>
    duplicate: (filePath: string) => Promise<string>
    softDelete: (rootPath: string, itemPath: string, type: 'file' | 'folder') => Promise<TrashManifest>
    saveImage: (
      noteFilePath: string,
      base64Data: string,
      ext: string,
      vaultRoot: string,
      settings: AttachmentFolderSettings
    ) => Promise<SaveImageResult>
    getLastVaultPath: () => Promise<string | null>
    setLastVaultPath: (vaultPath: string | null) => Promise<void>
    updateRefs: (vaultRoot: string, oldPath: string, newPath: string) => Promise<string[]>
    listRecent: () => Promise<VaultHistoryEntry[]>
    removeRecent: (path: string) => Promise<void>
    saveSession: (vaultPath: string, session: VaultSession) => Promise<void>
    getSession: (vaultPath: string) => Promise<VaultSession | null>
  }
  trash: {
    list: (rootPath: string) => Promise<TrashManifest[]>
    restore: (rootPath: string, id: string) => Promise<string>
    purge: (rootPath: string, id: string) => Promise<void>
  }
  templates: {
    list: () => Promise<string[]>
    getContent: (name: string) => Promise<string>
  }
  search: {
    query: (rootPath: string, query: string, mode: 'all' | 'code') => Promise<SearchResult[]>
  }
  exposure: {
    getStatus: () => Promise<ExposureStatus>
    setPassword: (password: string) => Promise<void>
    setBearerToken: (token: string | null) => Promise<void>
    setBindConfig: (bindAddress: string, port: number) => Promise<void>
    setVaultRoot: (rootPath: string) => Promise<void>
    start: () => Promise<{ ok: true } | { ok: false; error: string }>
    stop: () => Promise<void>
  }
  file: {
    read: (filePath: string) => Promise<string>
    write: (filePath: string, content: string) => Promise<void>
  }
  vaultSettings: {
    read: (rootPath: string) => Promise<VaultSettings>
    write: (rootPath: string, settings: VaultSettings) => Promise<void>
  }
  editor: {
    setDirty: (isDirty: boolean) => void
  }
  window: {
    findInPage: (text: string, options?: FindInPageOptions) => void
    stopFindInPage: () => void
    onFindResult: (callback: (result: FindInPageResult) => void) => () => void
    onConfirmClose: (callback: () => void) => () => void
    confirmCloseAccepted: () => void
    getToggleShortcut: () => Promise<string>
    setToggleShortcut: (accelerator: string) => Promise<SetToggleShortcutResult>
  }
  variables: {
    scanUsage: (rootPath: string) => Promise<Record<string, string[]>>
    loadPersisted: (rootPath: string) => Promise<VariablesExport>
    persistValues: (rootPath: string, values: Record<string, string>) => Promise<void>
    saveContext: (rootPath: string, name: string, values: Record<string, string>) => Promise<VariableContext>
    deleteContext: (rootPath: string, name: string) => Promise<void>
    exportJson: (rootPath: string) => Promise<string | null>
    importJson: (rootPath: string) => Promise<VariablesExport | null>
    readMeta: (rootPath: string) => Promise<VariablesMeta>
    writeMeta: (rootPath: string, meta: VariablesMeta) => Promise<void>
  }
}
