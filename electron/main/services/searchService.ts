import { promises as fs } from 'fs'
import { join, basename } from 'path'
import MiniSearch from 'minisearch'

const IGNORED_NAMES = new Set(['.cheatsheets-app', '.git', 'node_modules'])

interface VaultDoc {
  id: string
  name: string
  content: string
  code: string
}

function extractCodeBlocks(markdown: string): string {
  const blocks: string[] = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    blocks.push(match[1])
  }
  return blocks.join('\n')
}

async function collectDocs(rootPath: string): Promise<VaultDoc[]> {
  const docs: VaultDoc[] = []

  async function visit(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.')) continue
      const entryPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await visit(entryPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const content = await fs.readFile(entryPath, 'utf-8')
        docs.push({ id: entryPath, name: basename(entryPath), content, code: extractCodeBlocks(content) })
      }
    }
  }

  await visit(rootPath)
  return docs
}

export interface SearchResult {
  filePath: string
  name: string
  snippet?: string
}

function extractSnippet(content: string, query: string): string {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const lower = content.toLowerCase()
  let bestIdx = -1
  for (const word of words) {
    const idx = lower.indexOf(word)
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx
  }
  if (bestIdx === -1) return ''
  const start = Math.max(0, bestIdx - 30)
  const end = Math.min(content.length, start + 160)
  let snippet = content.slice(start, end).replace(/\n+/g, ' ').trim()
  if (start > 0) snippet = '…' + snippet
  if (end < content.length) snippet += '…'
  return snippet
}

export async function searchVault(
  rootPath: string,
  query: string,
  mode: 'all' | 'code'
): Promise<SearchResult[]> {
  const docs = await collectDocs(rootPath)
  const docsById = new Map(docs.map((d) => [d.id, d]))

  const miniSearch = new MiniSearch<VaultDoc>({
    fields: ['name', 'content', 'code'],
    storeFields: ['name'],
    idField: 'id'
  })
  miniSearch.addAll(docs)

  const results = miniSearch.search(query, {
    fields: mode === 'code' ? ['code'] : ['name', 'content', 'code'],
    prefix: true,
    fuzzy: 0.2
  })

  return results.map((r) => {
    const doc = docsById.get(String(r.id))
    const source = mode === 'code' ? (doc?.code ?? '') : (doc?.content ?? '')
    return {
      filePath: String(r.id),
      name: r.name as string,
      snippet: extractSnippet(source, query)
    }
  })
}
