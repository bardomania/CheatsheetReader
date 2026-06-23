import type { VaultTreeNode } from '../../../../electron/main/shared-types'

export interface FileMetric {
  path: string
  lineCount: number
  concept: string
  tags: string[]
}

function topLevelFolder(path: string, rootPath: string): string | null {
  const normalizedRoot = rootPath.replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  const rel = normalizedPath.startsWith(normalizedRoot) ? normalizedPath.slice(normalizedRoot.length) : normalizedPath
  const parts = rel.split('/').filter(Boolean)
  return parts.length > 1 ? parts[0] : null
}

function extractFrontmatterTags(content: string): string[] {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return []
  const block = match[1]

  // tags: [a, b, c]
  const inline = block.match(/^tags\s*:\s*\[([^\]]*)\]/m)
  if (inline) {
    return inline[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  // tags:\n  - a\n  - b
  const listMatch = block.match(/^tags\s*:\s*\r?\n((?:[ \t]+-[^\r\n]*\r?\n?)+)/m)
  if (listMatch) {
    return listMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  return []
}

export function computeMetric(path: string, content: string, rootPath: string): FileMetric {
  return {
    path,
    lineCount: Math.max(1, content.split('\n').length),
    concept: topLevelFolder(path, rootPath) ?? 'general',
    tags: extractFrontmatterTags(content)
  }
}

export function collectFilePaths(nodes: VaultTreeNode[]): string[] {
  const paths: string[] = []
  function visit(items: VaultTreeNode[]): void {
    for (const node of items) {
      if (node.type === 'file' && node.name.toLowerCase().endsWith('.md')) paths.push(node.path)
      else if (node.children) visit(node.children)
    }
  }
  visit(nodes)
  return paths
}

const ATLAS_FILE_RE = /\.(md|canvas)$/i

export function filterAtlasTree(nodes: VaultTreeNode[]): VaultTreeNode[] {
  const result: VaultTreeNode[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      if (ATLAS_FILE_RE.test(node.name)) result.push(node)
    } else if (node.children) {
      const children = filterAtlasTree(node.children)
      if (children.length > 0) result.push({ ...node, children })
    }
  }
  return result
}

const PALETTE = ['#5b8def', '#39d98a', '#e0a93f', '#e06c6c', '#a86cf0', '#3ddcd0', '#d9667a', '#9fd93d']

export function colorForConcept(concept: string): string {
  let hash = 0
  for (let i = 0; i < concept.length; i++) hash = (hash * 31 + concept.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
