import { isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import { writeClipboard, toOneLiner } from '../../lib/clipboard'
import { PLACEHOLDER_RE, resolve } from '../../../../../electron/main/services/variableEngine'

interface PreBlockProps {
  children?: ReactNode
  [key: string]: unknown
}

interface MenuState {
  x: number
  y: number
  lineIndex: number | null
  selectionText: string | null
}

function lineIndexAtPoint(codeEl: HTMLElement, raw: string, x: number, y: number): number | null {
  const docWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const range = docWithCaret.caretRangeFromPoint?.(x, y)
  if (!range) return null

  const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT)
  let offset = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node === range.startContainer) {
      offset += range.startOffset
      break
    }
    offset += node.textContent?.length ?? 0
  }

  const lines = raw.split('\n')
  let consumed = 0
  for (let i = 0; i < lines.length; i++) {
    consumed += lines[i].length + 1
    if (offset < consumed) return i
  }
  return lines.length - 1
}

function renderWithVars(original: string, varValues: Record<string, string>): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  const pattern = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags)

  for (const match of original.matchAll(pattern)) {
    const [full, name, funcArg] = match
    const idx = match.index!
    const varName = funcArg ?? name

    if (idx > lastIndex) parts.push(original.slice(lastIndex, idx))

    const tooltipTitle = funcArg ? `{{${name}(${varName})}}` : `{{${varName}}}`
    const { resolved, missing } = resolve(full, varValues)

    if (missing.size === 0) {
      parts.push(<span key={idx} className="var-resolved" title={tooltipTitle}>{resolved}</span>)
    } else {
      parts.push(<span key={idx} className="var-missing" title={`${tooltipTitle} — not set`}>{full}</span>)
    }

    lastIndex = idx + full.length
  }

  if (lastIndex < original.length) parts.push(original.slice(lastIndex))

  return parts
}

export default function PreBlock(props: PreBlockProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const codeElement = isValidElement(props.children)
    ? (props.children as ReactElement<Record<string, unknown>>)
    : null
  const rawProp = codeElement?.props?.['data-raw']
  const raw = typeof rawProp === 'string' ? rawProp : null

  const originalProp = codeElement?.props?.['data-original']
  const original = typeof originalProp === 'string' ? originalProp : null

  const varJsonProp = codeElement?.props?.['data-var-json']
  const varValues: Record<string, string> = typeof varJsonProp === 'string' ? JSON.parse(varJsonProp) : {}

  const hasVars = original !== null

  if (!raw) {
    return <pre>{props.children}</pre>
  }

  const lines = raw.split('\n')

  function openMenu(e: React.MouseEvent<HTMLPreElement>): void {
    e.preventDefault()
    const selectionText = window.getSelection()?.toString() || null
    const target = e.currentTarget.querySelector('code') as HTMLElement | null
    const lineIndex = target ? lineIndexAtPoint(target, raw!, e.clientX, e.clientY) : null
    setMenu({ x: e.clientX, y: e.clientY, lineIndex, selectionText })
  }

  function closeMenu(): void {
    setMenu(null)
  }

  async function copyAndClose(text: string): Promise<void> {
    await writeClipboard(text)
    closeMenu()
  }

  return (
    <div className="code-block-wrapper">
      <button
        className="btn btn-secondary btn-compact code-copy-btn"
        title="Copy code block"
        onClick={() => writeClipboard(raw!)}
      >
        Copy
      </button>
      <pre onContextMenu={openMenu}>
        {hasVars
          ? <code>{renderWithVars(original!, varValues)}</code>
          : props.children
        }
      </pre>

      {menu && (
        <>
          <div className="context-menu-backdrop" onClick={closeMenu} onContextMenu={(e) => e.preventDefault()} />
          <div className="context-menu" style={{ top: menu.y, left: menu.x }}>
            <button className="context-menu-item" onClick={() => copyAndClose(raw!)}>Copy block</button>
            <button className="context-menu-item" onClick={() => copyAndClose(toOneLiner(raw!))}>Copy as one-liner</button>
            {menu.lineIndex !== null && (
              <button className="context-menu-item" onClick={() => copyAndClose(lines[menu.lineIndex!])}>
                Copy line {menu.lineIndex + 1}
              </button>
            )}
            {menu.selectionText && (
              <button className="context-menu-item" onClick={() => copyAndClose(menu.selectionText!)}>Copy selection</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
