import { writeClipboard, toOneLiner } from '../../lib/clipboard'
import { resolve } from '../../../../../electron/main/services/variableEngine'

interface CommandsViewProps {
  content: string
  variableValues: Record<string, string>
}

function extractCodeBlocks(markdown: string): string[] {
  const blocks: string[] = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    blocks.push(match[1].replace(/\n$/, ''))
  }
  return blocks
}

export default function CommandsView({ content, variableValues }: CommandsViewProps) {
  const blocks = extractCodeBlocks(content).map((raw) => resolve(raw, variableValues).resolved)

  if (blocks.length === 0) {
    return <p className="empty-hint">No code blocks in this cheatsheet.</p>
  }

  return (
    <div className="commands-view">
      {blocks.map((block, i) => (
        <div key={i} className="commands-view-item">
          <pre>{block}</pre>
          <div className="commands-view-actions">
            <button className="btn btn-secondary btn-compact" onClick={() => writeClipboard(block)}>Copy</button>
            <button className="btn btn-secondary btn-compact" onClick={() => writeClipboard(toOneLiner(block))}>Copy as one-liner</button>
          </div>
        </div>
      ))}
    </div>
  )
}
