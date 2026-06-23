import { useMemo } from 'react'
import { renderMarkdown } from '../../lib/markdownRenderer'
import { writeClipboard } from '../../lib/clipboard'
import type { FilePathIndex } from '../../lib/wikiLinks'

interface MarkdownPreviewProps {
  content: string
  filePath: string
  vaultRoot: string
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  variableValues: Record<string, string>
  onNavigate: (filePath: string) => void
  onToggleCheckbox: (lineIndex: number) => void
}

export default function MarkdownPreview({
  content,
  filePath,
  vaultRoot,
  wikiLinkIndex,
  embedIndex,
  variableValues,
  onNavigate,
  onToggleCheckbox
}: MarkdownPreviewProps) {
  const { element, codeBlocks } = useMemo(
    () =>
      renderMarkdown({
        content,
        filePath,
        vaultRoot,
        wikiLinkIndex,
        embedIndex,
        variableValues,
        onNavigate,
        onToggleCheckbox
      }),
    [content, filePath, vaultRoot, wikiLinkIndex, embedIndex, variableValues, onNavigate, onToggleCheckbox]
  )

  async function copyAllCodeBlocks(): Promise<void> {
    await writeClipboard(codeBlocks.join('\n\n'))
  }

  return (
    <div>
      {codeBlocks.length > 0 && (
        <div className="preview-toolbar">
          <button className="btn btn-secondary btn-compact" onClick={copyAllCodeBlocks}>Copy all code blocks ({codeBlocks.length})</button>
        </div>
      )}
      <div className="markdown-preview">{element}</div>
    </div>
  )
}
