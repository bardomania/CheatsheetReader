import { useContext, useEffect, useState } from 'react'
import { api } from '../../lib/ipc'
import { vaultAssetUrl } from '../../lib/vaultAssetUrl'
import { renderMarkdown } from '../../lib/markdownRenderer'
import { CanvasRenderContext } from './canvasRenderContext'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

interface MiniCanvasNode {
  x: number
  y: number
  width: number
  height: number
  color?: string
  type?: string
}

interface CanvasFilePreviewProps {
  resolvedPath?: string
  fileLabel?: string
}

function extensionOf(path: string): string {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? '' : path.slice(idx + 1).toLowerCase()
}

function FallbackCard({ fileLabel }: { fileLabel?: string }): React.ReactElement {
  return (
    <div className="canvas-node-file">
      <span className="canvas-node-icon">▤</span>
      {fileLabel}
    </div>
  )
}

function MiniCanvasDiagram({ nodes }: { nodes: MiniCanvasNode[] }): React.ReactElement {
  if (nodes.length === 0) return <div className="canvas-node-mini-canvas empty" />

  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.width))
  const maxY = Math.max(...nodes.map((n) => n.y + n.height))
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)

  return (
    <div className="canvas-node-mini-canvas">
      {nodes.map((n, i) => (
        <div
          key={i}
          className="canvas-node-mini-shape"
          style={{
            left: `${((n.x - minX) / spanX) * 100}%`,
            top: `${((n.y - minY) / spanY) * 100}%`,
            width: `${(n.width / spanX) * 100}%`,
            height: `${(n.height / spanY) * 100}%`,
            background: n.color || 'var(--border-strong)'
          }}
        />
      ))}
    </div>
  )
}

export default function CanvasFilePreview({ resolvedPath, fileLabel }: CanvasFilePreviewProps): React.ReactElement {
  const ctx = useContext(CanvasRenderContext)
  const ext = resolvedPath ? extensionOf(resolvedPath) : ''
  const isMarkdown = ext === 'md'
  const isNestedCanvas = ext === 'canvas'

  const [textContent, setTextContent] = useState<string | null>(null)

  useEffect(() => {
    setTextContent(null)
    if (!resolvedPath || !(isMarkdown || isNestedCanvas)) return
    let cancelled = false
    api()
      .file.read(resolvedPath)
      .then((text) => {
        if (!cancelled) setTextContent(text)
      })
      .catch(() => {
        if (!cancelled) setTextContent(null)
      })
    return () => {
      cancelled = true
    }
  }, [resolvedPath, isMarkdown, isNestedCanvas])

  if (!resolvedPath) return <FallbackCard fileLabel={fileLabel} />

  if (IMAGE_EXTENSIONS.has(ext)) {
    return <img className="canvas-node-media nodrag" src={vaultAssetUrl(resolvedPath)} alt={fileLabel} />
  }

  if (ext === 'pdf') {
    return <iframe className="canvas-node-media-pdf nodrag" src={vaultAssetUrl(resolvedPath)} title={fileLabel} />
  }

  if (isMarkdown) {
    if (textContent === null || !ctx) return <FallbackCard fileLabel={fileLabel} />
    let element: React.ReactElement | null = null
    try {
      element = renderMarkdown({
        content: textContent,
        filePath: resolvedPath,
        vaultRoot: ctx.vaultRoot,
        wikiLinkIndex: ctx.wikiLinkIndex,
        embedIndex: ctx.embedIndex,
        variableValues: ctx.variableValues,
        onNavigate: ctx.onNavigate,
        collectCodeBlocks: false
      }).element
    } catch {
      element = null
    }
    return (
      <div className="canvas-node-md-preview markdown-preview nodrag">
        {element ?? <FallbackCard fileLabel={fileLabel} />}
      </div>
    )
  }

  if (isNestedCanvas) {
    if (textContent === null) return <FallbackCard fileLabel={fileLabel} />
    try {
      const parsed = JSON.parse(textContent) as { nodes?: MiniCanvasNode[] }
      return <MiniCanvasDiagram nodes={parsed.nodes ?? []} />
    } catch {
      return <FallbackCard fileLabel={fileLabel} />
    }
  }

  return <FallbackCard fileLabel={fileLabel} />
}
