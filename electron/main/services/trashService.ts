import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'
import { randomUUID } from 'crypto'

const TRASH_DIR_NAME = '.cheatsheets-app/trash'

export interface TrashManifest {
  id: string
  originalPath: string
  name: string
  type: 'file' | 'folder'
  deletedAt: string
}

function trashRoot(rootPath: string): string {
  return join(rootPath, TRASH_DIR_NAME)
}

function entryDir(rootPath: string, id: string): string {
  return join(trashRoot(rootPath), id)
}

function manifestFile(rootPath: string, id: string): string {
  return join(entryDir(rootPath, id), 'manifest.json')
}

function payloadPath(rootPath: string, id: string, name: string): string {
  return join(entryDir(rootPath, id), 'payload', name)
}

export async function softDelete(
  rootPath: string,
  itemPath: string,
  type: 'file' | 'folder'
): Promise<TrashManifest> {
  const id = randomUUID()
  const name = basename(itemPath)
  const dest = payloadPath(rootPath, id, name)

  await fs.mkdir(dirname(dest), { recursive: true })
  await fs.rename(itemPath, dest)

  const manifest: TrashManifest = {
    id,
    originalPath: itemPath,
    name,
    type,
    deletedAt: new Date().toISOString()
  }
  await fs.writeFile(manifestFile(rootPath, id), JSON.stringify(manifest, null, 2), 'utf-8')

  return manifest
}

export async function listTrash(rootPath: string): Promise<TrashManifest[]> {
  let ids: string[]
  try {
    ids = await fs.readdir(trashRoot(rootPath))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  const manifests: TrashManifest[] = []
  for (const id of ids) {
    try {
      const content = await fs.readFile(manifestFile(rootPath, id), 'utf-8')
      manifests.push(JSON.parse(content))
    } catch {
      // Skip malformed/partial trash entries rather than failing the whole list.
    }
  }
  return manifests.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function uniqueDestination(originalPath: string): Promise<string> {
  if (!(await pathExists(originalPath))) return originalPath
  const dir = dirname(originalPath)
  const name = basename(originalPath)
  const dotIndex = name.lastIndexOf('.')
  const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex > 0 ? name.slice(dotIndex) : ''

  let n = 2
  let candidate = join(dir, `${stem} (restored)${ext}`)
  while (await pathExists(candidate)) {
    candidate = join(dir, `${stem} (restored ${n})${ext}`)
    n++
  }
  return candidate
}

export async function restoreFromTrash(rootPath: string, id: string): Promise<string> {
  const manifest: TrashManifest = JSON.parse(await fs.readFile(manifestFile(rootPath, id), 'utf-8'))
  const source = payloadPath(rootPath, id, manifest.name)
  const destination = await uniqueDestination(manifest.originalPath)

  await fs.mkdir(dirname(destination), { recursive: true })
  await fs.rename(source, destination)
  await fs.rm(entryDir(rootPath, id), { recursive: true, force: true })

  return destination
}

export async function purgeFromTrash(rootPath: string, id: string): Promise<void> {
  await fs.rm(entryDir(rootPath, id), { recursive: true, force: true })
}
