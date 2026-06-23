import type { VaultTreeNode } from '../../../../electron/main/shared-types'
import { dirnameOf, resolveRelative } from './paths'

export type WikiLinkResolution =
  | { status: 'resolved'; path: string }
  | { status: 'ambiguous'; path: string; candidates: string[] }
  | { status: 'missing'; name: string }

export type FilePathIndex = Map<string, string[]>

const NOTE_EXTENSIONS = new Set(['md', 'canvas'])
const EMBEDDABLE_EXTENSIONS = new Set(['canvas', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'pdf'])

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

function stemOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? name : name.slice(0, idx)
}

function addToIndex(index: FilePathIndex, key: string, filePath: string): void {
  const existing = index.get(key) ?? []
  if (!existing.includes(filePath)) existing.push(filePath)
  index.set(key, existing)
}

export function normalize(name: string): string {
  return name.toLowerCase().replace(/\.md$/, '').trim()
}

export function buildFilePathIndex(tree: VaultTreeNode[], extensions: Set<string>): FilePathIndex {
  const index: FilePathIndex = new Map()

  function visit(nodes: VaultTreeNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file' && extensions.has(extensionOf(node.name))) {
        addToIndex(index, normalize(node.name), node.path)
        addToIndex(index, normalize(stemOf(node.name)), node.path)
      } else if (node.type === 'folder' && node.children) {
        visit(node.children)
      }
    }
  }

  visit(tree)
  return index
}

export function buildWikiLinkIndex(tree: VaultTreeNode[]): FilePathIndex {
  return buildFilePathIndex(tree, NOTE_EXTENSIONS)
}

export function buildEmbedIndex(tree: VaultTreeNode[]): FilePathIndex {
  return buildFilePathIndex(tree, EMBEDDABLE_EXTENSIONS)
}

export function resolveWikiLink(index: FilePathIndex, target: string, fromFilePath: string): WikiLinkResolution {
  const key = normalize(target.split('/').pop() ?? target)
  const candidates = index.get(key)

  if (!candidates || candidates.length === 0) {
    return { status: 'missing', name: target }
  }

  if (candidates.length === 1) {
    return { status: 'resolved', path: candidates[0] }
  }

  const fromDir = dirnameOf(fromFilePath)
  const sameFolder = candidates.find((p) => dirnameOf(p) === fromDir)
  if (sameFolder) {
    return { status: 'resolved', path: sameFolder }
  }

  const sorted = [...candidates].sort()
  return { status: 'ambiguous', path: sorted[0], candidates: sorted }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function pathDepth(path: string): number {
  return path.split('/').filter(Boolean).length
}

function rankEmbedCandidate(candidate: string, fromFilePath: string): number {
  const fromDir = dirnameOf(fromFilePath)
  const candidateDir = dirnameOf(candidate)
  const normalizedFromDir = normalizePath(fromDir)
  const normalizedCandidateDir = normalizePath(candidateDir)

  if (normalizedCandidateDir === normalizedFromDir) return 0
  if (normalizedCandidateDir === `${normalizedFromDir}/assets`) return 1

  const candidateParts = normalizedCandidateDir.split('/')
  const assetSegment = candidateParts.lastIndexOf('assets')
  if (assetSegment !== -1) {
    const assetParent = candidateParts.slice(0, assetSegment).join('/')
    if (normalizedFromDir === assetParent || normalizedFromDir.startsWith(`${assetParent}/`)) {
      return 2 + Math.max(0, pathDepth(normalizedFromDir) - pathDepth(assetParent))
    }
  }

  return 1000 + pathDepth(normalizedCandidateDir)
}

function resolveBareEmbedTarget(index: FilePathIndex, rawTarget: string, fromFilePath: string): WikiLinkResolution {
  const key = normalize(rawTarget)
  const candidates = index.get(key)

  if (!candidates || candidates.length === 0) {
    return { status: 'missing', name: rawTarget }
  }

  const ranked = [...candidates].sort((a, b) => {
    const rankDelta = rankEmbedCandidate(a, fromFilePath) - rankEmbedCandidate(b, fromFilePath)
    return rankDelta || a.localeCompare(b)
  })

  const bestRank = rankEmbedCandidate(ranked[0], fromFilePath)
  const equallyGood = ranked.filter((candidate) => rankEmbedCandidate(candidate, fromFilePath) === bestRank)

  if (equallyGood.length === 1) {
    return { status: 'resolved', path: ranked[0] }
  }

  return { status: 'ambiguous', path: ranked[0], candidates: equallyGood }
}

// Path-like targets (containing a slash) follow Obsidian's actual convention:
// they're vault-root-relative, not relative to the file that references them
// (this matters for .canvas file-node links and `![[folder/file]]` embeds —
// resolving against the referencing file's own folder doubles the directory
// whenever that file isn't at the vault root).
export function resolveEmbedTarget(
  index: FilePathIndex,
  rawTarget: string,
  vaultRoot: string,
  fromFilePath: string
): WikiLinkResolution {
  if (rawTarget.includes('/') || rawTarget.includes('\\')) {
    return { status: 'resolved', path: resolveRelative(vaultRoot, rawTarget) }
  }
  return resolveBareEmbedTarget(index, rawTarget, fromFilePath)
}
