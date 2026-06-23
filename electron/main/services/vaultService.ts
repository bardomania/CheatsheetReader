import { dialog } from 'electron'
import { promises as fs } from 'fs'
import { join, basename, dirname, relative } from 'path'
import type { VaultTreeNode, AttachmentFolderSettings, SaveImageResult } from '../shared-types'
import { detectVariableNames } from './variableEngine'
import { resolveWithinVault } from './httpServer/pathGuard'

export async function pickFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

const IGNORED_NAMES = new Set(['.cheatsheets-app', '.git', 'node_modules'])

export async function getTree(rootPath: string): Promise<VaultTreeNode[]> {
  return walkDirectory(rootPath)
}

async function walkDirectory(dirPath: string): Promise<VaultTreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: VaultTreeNode[] = []

  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue

    const entryPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'folder',
        children: await walkDirectory(entryPath)
      })
    } else if (entry.isFile() && /\.(md|canvas|png|jpe?g|gif|svg|webp|bmp|pdf)$/i.test(entry.name)) {
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'file'
      })
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

function withMdExtension(name: string): string {
  return name.toLowerCase().endsWith('.md') ? name : `${name}.md`
}

export async function createFile(parentDirPath: string, name: string, content = ''): Promise<string> {
  const filePath = join(parentDirPath, withMdExtension(name))
  if (await pathExists(filePath)) throw new Error(`"${withMdExtension(name)}" already exists`)
  await fs.writeFile(filePath, content, 'utf-8')
  return filePath
}

export async function createFolder(parentDirPath: string, name: string): Promise<string> {
  const folderPath = join(parentDirPath, name)
  if (await pathExists(folderPath)) throw new Error(`"${name}" already exists`)
  await fs.mkdir(folderPath, { recursive: true })
  return folderPath
}

export async function renamePath(oldPath: string, newName: string, type: 'file' | 'folder'): Promise<string> {
  const dir = dirname(oldPath)
  const finalName = type === 'file' ? withMdExtension(newName) : newName
  const newPath = join(dir, finalName)
  if (newPath !== oldPath && (await pathExists(newPath))) {
    throw new Error(`"${finalName}" already exists`)
  }
  await fs.rename(oldPath, newPath)
  return newPath
}

export async function movePath(sourcePath: string, destDirPath: string): Promise<string> {
  const newPath = join(destDirPath, basename(sourcePath))
  if (newPath === sourcePath) return sourcePath
  if (await pathExists(newPath)) throw new Error(`"${basename(sourcePath)}" already exists in the destination`)
  await fs.rename(sourcePath, newPath)
  return newPath
}

export async function duplicateFile(filePath: string): Promise<string> {
  const dir = dirname(filePath)
  const name = basename(filePath)
  const dotIndex = name.lastIndexOf('.')
  const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex > 0 ? name.slice(dotIndex) : ''

  let candidate = join(dir, `${stem} (copy)${ext}`)
  let n = 2
  while (await pathExists(candidate)) {
    candidate = join(dir, `${stem} (copy ${n})${ext}`)
    n++
  }

  await fs.copyFile(filePath, candidate)
  return candidate
}

function resolveAttachmentDir(vaultRoot: string, noteFilePath: string, settings: AttachmentFolderSettings): string {
  const noteDir = dirname(noteFilePath)
  switch (settings.mode) {
    case 'vault-folder':
    case 'fixed-folder':
      return join(vaultRoot, settings.folderName)
    case 'subfolder':
      return join(noteDir, settings.folderName)
    case 'same-folder':
    default:
      return noteDir
  }
}

export async function saveImage(
  noteFilePath: string,
  base64Data: string,
  ext: string,
  vaultRoot: string,
  settings: AttachmentFolderSettings
): Promise<SaveImageResult> {
  const targetDir = resolveAttachmentDir(vaultRoot, noteFilePath, settings)
  if (!resolveWithinVault(vaultRoot, targetDir)) {
    throw new Error('Configured attachment folder resolves outside the vault')
  }
  await fs.mkdir(targetDir, { recursive: true })

  const name = `pasted-${Date.now()}.${ext}`
  const absolutePath = join(targetDir, name)
  await fs.writeFile(absolutePath, Buffer.from(base64Data, 'base64'))

  const relativeFromNote = relative(dirname(noteFilePath), absolutePath).split('\\').join('/')
  return { absolutePath, relativeFromNote }
}

export async function scanVariableUsage(rootPath: string): Promise<Record<string, string[]>> {
  const usage: Record<string, string[]> = {}

  async function visit(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue
      const entryPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const content = await fs.readFile(entryPath, 'utf-8')
        for (const name of detectVariableNames(content)) {
          if (!usage[name]) usage[name] = []
          usage[name].push(entryPath)
        }
      }
    }
  }

  await visit(rootPath)
  return usage
}
