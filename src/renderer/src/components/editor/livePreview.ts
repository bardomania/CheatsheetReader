import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { resolveWikiLink, resolveEmbedTarget, type FilePathIndex } from '../../lib/wikiLinks'

export interface LivePreviewOptions {
  filePath: string
  vaultRoot: string
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  onNavigate: (path: string) => void
}

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private from: number,
    private to: number
  ) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from && other.to === this.to
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-task-checkbox'
    input.checked = this.checked
    input.addEventListener('mousedown', (e) => e.preventDefault())
    input.addEventListener('click', () => {
      const next = this.checked ? ' ' : 'x'
      view.dispatch({ changes: { from: this.from, to: this.to, insert: `[${next}]` } })
    })
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}

class WikiLinkWidget extends WidgetType {
  constructor(
    private label: string,
    private status: 'resolved' | 'ambiguous' | 'missing',
    private isEmbed: boolean,
    private onClick: () => void
  ) {
    super()
  }

  eq(other: WikiLinkWidget): boolean {
    return other.label === this.label && other.status === this.status && other.isEmbed === this.isEmbed
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = `cm-wiki-link cm-wiki-link-${this.status}${this.isEmbed ? ' cm-wiki-link-embed' : ''}`
    span.textContent = (this.isEmbed ? '🖼 ' : '') + this.label
    if (this.status !== 'missing') {
      span.style.cursor = 'pointer'
      span.addEventListener('mousedown', (e) => e.preventDefault())
      span.addEventListener('click', () => this.onClick())
    }
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

class HRWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-md-hr'
    return el
  }

  ignoreEvent(): boolean {
    return true
  }
}

const WIKI_RE = /(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

interface PendingDecoration {
  from: number
  to: number
  deco: Decoration
}

function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  const pending: PendingDecoration[] = []
  const active = view.state.doc.lineAt(view.state.selection.main.head)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        // On the active line, show raw markdown so the user can edit it.
        const onActiveLine = node.from <= active.to && node.to >= active.from
        if (onActiveLine) return false

        const headingMatch = node.name.match(/^ATXHeading([1-6])$/)
        if (headingMatch) {
          const level = headingMatch[1]
          const mark = node.node.getChild('HeaderMark')
          if (mark) {
            // Line decoration for heading spacing
            const lineStart = view.state.doc.lineAt(node.from).from
            pending.push({ from: lineStart, to: lineStart, deco: Decoration.line({ class: `cm-md-h${level}-line` }) })
            // Hide "# " (include the trailing space)
            const hideEnd = Math.min(mark.to + 1, node.to)
            pending.push({ from: mark.from, to: hideEnd, deco: Decoration.replace({}) })
            if (hideEnd < node.to) {
              pending.push({ from: hideEnd, to: node.to, deco: Decoration.mark({ class: `cm-md-h${level}` }) })
            }
          }
          return
        }

        if (node.name === 'HorizontalRule') {
          pending.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new HRWidget() }) })
          return
        }

        if (node.name === 'Link') {
          const marks = node.node.getChildren('LinkMark')
          // marks: [ ] ( )
          if (marks.length >= 4) {
            pending.push({ from: marks[0].from, to: marks[0].to, deco: Decoration.replace({}) })
            pending.push({ from: marks[0].to, to: marks[1].from, deco: Decoration.mark({ class: 'cm-md-link' }) })
            pending.push({ from: marks[1].from, to: node.to, deco: Decoration.replace({}) })
          }
          return
        }

        if (node.name === 'StrongEmphasis') {
          const marks = node.node.getChildren('EmphasisMark')
          if (marks.length === 2) {
            pending.push({ from: marks[0].from, to: marks[0].to, deco: Decoration.replace({}) })
            pending.push({ from: marks[0].to, to: marks[1].from, deco: Decoration.mark({ class: 'cm-md-bold' }) })
            pending.push({ from: marks[1].from, to: marks[1].to, deco: Decoration.replace({}) })
          }
          return
        }

        if (node.name === 'Emphasis') {
          const marks = node.node.getChildren('EmphasisMark')
          if (marks.length === 2) {
            pending.push({ from: marks[0].from, to: marks[0].to, deco: Decoration.replace({}) })
            pending.push({ from: marks[0].to, to: marks[1].from, deco: Decoration.mark({ class: 'cm-md-italic' }) })
            pending.push({ from: marks[1].from, to: marks[1].to, deco: Decoration.replace({}) })
          }
          return
        }

        if (node.name === 'Strikethrough') {
          const marks = node.node.getChildren('StrikethroughMark')
          if (marks.length === 2) {
            pending.push({ from: marks[0].from, to: marks[0].to, deco: Decoration.replace({}) })
            pending.push({ from: marks[0].to, to: marks[1].from, deco: Decoration.mark({ class: 'cm-md-strike' }) })
            pending.push({ from: marks[1].from, to: marks[1].to, deco: Decoration.replace({}) })
          }
          return
        }

        if (node.name === 'InlineCode') {
          const marks = node.node.getChildren('CodeMark')
          if (marks.length >= 2) {
            const first = marks[0]
            const last = marks[marks.length - 1]
            pending.push({ from: first.from, to: first.to, deco: Decoration.replace({}) })
            pending.push({ from: first.to, to: last.from, deco: Decoration.mark({ class: 'cm-md-code' }) })
            pending.push({ from: last.from, to: last.to, deco: Decoration.replace({}) })
          }
          return
        }

        if (node.name === 'Task') {
          const marker = node.node.getChild('TaskMarker')
          if (marker) {
            const checked = /x/i.test(view.state.sliceDoc(marker.from, marker.to))
            pending.push({
              from: marker.from,
              to: marker.to,
              deco: Decoration.replace({ widget: new CheckboxWidget(checked, marker.from, marker.to) })
            })
          }
        }
      }
    })

    // Wiki-links/embeds: cheap regex pass since they're not in the Lezer grammar.
    let lineNum = view.state.doc.lineAt(from).number
    const lastLine = view.state.doc.lineAt(to).number
    for (; lineNum <= lastLine; lineNum++) {
      const line = view.state.doc.line(lineNum)
      if (line.from <= active.to && line.to >= active.from) continue

      WIKI_RE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = WIKI_RE.exec(line.text))) {
        const isEmbed = !!match[1]
        const target = match[2]
        const alias = match[3]
        const start = line.from + match.index
        const end = start + match[0].length

        const resolution = isEmbed
          ? resolveEmbedTarget(options.embedIndex, target.split('#')[0], options.vaultRoot, options.filePath)
          : resolveWikiLink(options.wikiLinkIndex, target, options.filePath)

        const label = alias ?? target
        const targetPath =
          resolution.status === 'resolved' || resolution.status === 'ambiguous' ? resolution.path : null

        pending.push({
          from: start,
          to: end,
          deco: Decoration.replace({
            widget: new WikiLinkWidget(label, resolution.status, isEmbed, () => {
              if (targetPath) options.onNavigate(targetPath)
            })
          })
        })
      }
    }
  }

  // RangeSetBuilder requires ascending from, then ascending to for same from.
  // Line decorations (from === to) sort before range decorations at same position.
  pending.sort((a, b) => a.from - b.from || a.to - b.to)

  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to, deco } of pending) {
    try {
      builder.add(from, to, deco)
    } catch {
      // Skip decorations that violate ordering (can happen at viewport edges).
    }
  }
  return builder.finish()
}

export function livePreview(options: LivePreviewOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, options)
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, options)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}
