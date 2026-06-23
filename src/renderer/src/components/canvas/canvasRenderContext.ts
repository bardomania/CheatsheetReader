import { createContext } from 'react'
import type { FilePathIndex } from '../../lib/wikiLinks'

export interface CanvasRenderContextValue {
  filePath: string
  vaultRoot: string
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  variableValues: Record<string, string>
  onNavigate: (path: string) => void
  locked: boolean
}

// Shared by TextNode and CanvasFilePreview so neither needs every render
// dependency threaded individually through NodeData.
export const CanvasRenderContext = createContext<CanvasRenderContextValue | null>(null)
