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

const ATLAS_FILE_RE = /\.md$/i

export function filterAtlasTree(nodes: VaultTreeNode[]): VaultTreeNode[] {
  const cheatsheetRoot = nodes.find(
    (node) => node.type === 'folder' && node.name.toLowerCase() === 'cheatsheet'
  )
  const scope = cheatsheetRoot?.children ?? nodes
  const result: VaultTreeNode[] = []
  for (const node of scope) {
    if (node.type === 'file') {
      if (ATLAS_FILE_RE.test(node.name)) result.push(node)
    } else if (node.children) {
      const children = filterAtlasTree(node.children)
      if (children.length > 0) result.push({ ...node, children })
    }
  }
  return result
}

const CONCEPT_COLORS: Record<string, string> = {
  web: '#4f8cff',
  internal: '#ef6f6c',
  mobile: '#e5a94f',
  forensic: '#a978e8',
  forensics: '#a978e8',
  'ai red team': '#38c7b7',
  'ai-red-team': '#38c7b7',
  vim: '#7fb069',
  tooling: '#8a98a8'
}

const PALETTE = ['#4f8cff', '#38c7b7', '#e5a94f', '#ef6f6c', '#a978e8', '#63b3a4', '#d77893', '#8bbf5a']

export function colorForConcept(concept: string): string {
  const semanticColor = CONCEPT_COLORS[concept.toLowerCase()]
  if (semanticColor) return semanticColor
  let hash = 0
  for (let i = 0; i < concept.length; i++) hash = (hash * 31 + concept.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
