import { promises as fs } from 'fs'
import { join } from 'path'
import { dialog } from 'electron'

const CONFIG_DIR_NAME = '.cheatsheets-app'

export interface VariableContext {
  name: string
  values: Record<string, string>
  createdAt: string
  updatedAt: string
}

function configDir(rootPath: string): string {
  return join(rootPath, CONFIG_DIR_NAME)
}

function variablesFile(rootPath: string): string {
  return join(configDir(rootPath), 'variables.json')
}

function contextsDir(rootPath: string): string {
  return join(configDir(rootPath), 'contexts')
}

function vaultSettingsFile(rootPath: string): string {
  return join(configDir(rootPath), 'vault.json')
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

const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  autosaveEnabled: false,
  autosaveIntervalMs: 30_000,
  attachmentFolder: { mode: 'vault-folder', folderName: 'attachments' },
  activeContext: 'Default'
}

export async function readVaultSettings(rootPath: string): Promise<VaultSettings> {
  const stored = await readJsonIfExists<Partial<VaultSettings>>(vaultSettingsFile(rootPath))
  return { ...DEFAULT_VAULT_SETTINGS, ...stored }
}

export async function writeVaultSettings(rootPath: string, settings: VaultSettings): Promise<void> {
  await ensureDir(configDir(rootPath))
  await fs.writeFile(vaultSettingsFile(rootPath), JSON.stringify(settings, null, 2), 'utf-8')
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'context'
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export interface VariablesMeta {
  order: string[]
  presets: Record<string, string[]>
}

function variablesMetaFile(rootPath: string): string {
  return join(configDir(rootPath), 'variables-meta.json')
}

export async function readVariablesMeta(rootPath: string): Promise<VariablesMeta> {
  return (await readJsonIfExists<VariablesMeta>(variablesMetaFile(rootPath))) ?? { order: [], presets: {} }
}

export async function writeVariablesMeta(rootPath: string, meta: VariablesMeta): Promise<void> {
  await ensureDir(configDir(rootPath))
  await fs.writeFile(variablesMetaFile(rootPath), JSON.stringify(meta, null, 2), 'utf-8')
}

export async function readVariables(rootPath: string): Promise<Record<string, string>> {
  return (await readJsonIfExists<Record<string, string>>(variablesFile(rootPath))) ?? {}
}

export async function writeVariables(rootPath: string, values: Record<string, string>): Promise<void> {
  await ensureDir(configDir(rootPath))
  await fs.writeFile(variablesFile(rootPath), JSON.stringify(values, null, 2), 'utf-8')
}

export async function listContexts(rootPath: string): Promise<VariableContext[]> {
  const dir = contextsDir(rootPath)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const contexts: VariableContext[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const context = await readJsonIfExists<VariableContext>(join(dir, entry))
    if (context) contexts.push(context)
  }
  return contexts.sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveContext(
  rootPath: string,
  name: string,
  values: Record<string, string>
): Promise<VariableContext> {
  await ensureDir(contextsDir(rootPath))
  const filePath = join(contextsDir(rootPath), `${slugify(name)}.json`)
  const existing = await readJsonIfExists<VariableContext>(filePath)
  const now = new Date().toISOString()
  const context: VariableContext = {
    name,
    values,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  await fs.writeFile(filePath, JSON.stringify(context, null, 2), 'utf-8')
  return context
}

export async function deleteContext(rootPath: string, name: string): Promise<void> {
  const filePath = join(contextsDir(rootPath), `${slugify(name)}.json`)
  await fs.rm(filePath, { force: true })
}

export interface VariablesExport {
  values: Record<string, string>
  contexts: VariableContext[]
}

export async function exportVariablesJson(rootPath: string): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    defaultPath: 'cheatsheet-variables.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return null

  const payload: VariablesExport = {
    values: await readVariables(rootPath),
    contexts: await listContexts(rootPath)
  }
  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return result.filePath
}

export async function importVariablesJson(rootPath: string): Promise<VariablesExport | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const content = await fs.readFile(result.filePaths[0], 'utf-8')
  const payload = JSON.parse(content) as VariablesExport

  await writeVariables(rootPath, payload.values ?? {})
  for (const context of payload.contexts ?? []) {
    await saveContext(rootPath, context.name, context.values)
  }

  return {
    values: await readVariables(rootPath),
    contexts: await listContexts(rootPath)
  }
}
