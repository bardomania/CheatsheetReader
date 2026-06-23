import { findAndReplace } from 'mdast-util-find-and-replace'
import type { Root, Link } from 'mdast'
import { resolveWikiLink, resolveEmbedTarget, type FilePathIndex, type WikiLinkResolution } from './wikiLinks'

const WIKI_LINK_RE = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

interface Options {
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  vaultRoot: string
  fromFilePath: string
}

// Encodes the resolution outcome into the link href so the renderer's
// custom `a` component can style/handle resolved vs ambiguous vs missing
// targets without a second pass over the tree.
function encodeHref(resolution: WikiLinkResolution): string {
  if (resolution.status === 'resolved') return `wikilink://resolved/${encodeURIComponent(resolution.path)}`
  if (resolution.status === 'ambiguous') return `wikilink://ambiguous/${encodeURIComponent(resolution.path)}`
  return `wikilink://missing/${encodeURIComponent(resolution.name)}`
}

// `![[file.pdf#page=2]]` / `![[file.pdf#height=300]]` — Obsidian encodes embed display
// hints as a `#` fragment on the target itself, not the `|alias` slot.
function parseEmbedTarget(raw: string): { filePart: string; page?: number; height?: number } {
  const [filePart, fragment] = raw.split('#')
  if (!fragment) return { filePart }
  const pageMatch = fragment.match(/^page=(\d+)$/)
  if (pageMatch) return { filePart, page: Number(pageMatch[1]) }
  const heightMatch = fragment.match(/^height=(\d+)$/)
  if (heightMatch) return { filePart, height: Number(heightMatch[1]) }
  return { filePart }
}

function encodeEmbedHref(resolution: WikiLinkResolution, width?: number, page?: number, height?: number): string {
  const params = new URLSearchParams()
  if (width) params.set('w', String(width))
  if (page) params.set('page', String(page))
  if (height) params.set('h', String(height))
  const query = params.toString() ? `?${params.toString()}` : ''
  if (resolution.status === 'resolved') return `wikiembed://resolved/${encodeURIComponent(resolution.path)}${query}`
  if (resolution.status === 'ambiguous') return `wikiembed://ambiguous/${encodeURIComponent(resolution.path)}${query}`
  return `wikiembed://missing/${encodeURIComponent(resolution.name)}${query}`
}

export function remarkWikiLink({ wikiLinkIndex, embedIndex, vaultRoot, fromFilePath }: Options) {
  return (tree: Root): void => {
    findAndReplace(tree, [
      [
        WIKI_LINK_RE,
        (_match: string, bang: string | undefined, target: string, alias?: string): Link => {
          if (bang) {
            const { filePart, page, height } = parseEmbedTarget(target)
            const width = alias && /^\d+$/.test(alias) ? Number(alias) : undefined
            const resolution = resolveEmbedTarget(embedIndex, filePart, vaultRoot, fromFilePath)
            return {
              type: 'link',
              url: encodeEmbedHref(resolution, width, page, height),
              data: { hProperties: { className: ['wiki-embed-link'] } },
              children: [{ type: 'text', value: filePart }]
            }
          }

          const resolution = resolveWikiLink(wikiLinkIndex, target, fromFilePath)
          return {
            type: 'link',
            url: encodeHref(resolution),
            data: { hProperties: { className: ['wiki-link', `wiki-link-${resolution.status}`] } },
            children: [{ type: 'text', value: alias ?? target }]
          }
        }
      ]
    ])
  }
}
