import { useEffect, useRef } from 'react'
import { EditorView } from 'codemirror'
import { EditorState, EditorSelection } from '@codemirror/state'
import {
  keymap,
  highlightActiveLine,
  highlightSpecialChars,
  drawSelection,
  dropCursor
} from '@codemirror/view'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM } from '@lezer/markdown'
import { api } from '../../lib/ipc'
import { livePreview } from './livePreview'
import type { FilePathIndex } from '../../lib/wikiLinks'
import type { AttachmentFolderSettings } from '../../../../../electron/main/shared-types'

interface MarkdownEditorProps {
  value: string
  filePath: string
  vaultRoot: string
  attachmentFolder: AttachmentFolderSettings
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  onNavigate: (path: string) => void
  onChange: (value: string) => void
}

const proseTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-content': {
    fontFamily: 'inherit',
    padding: '28px 48px',
    maxWidth: '760px',
    boxSizing: 'border-box',
    lineHeight: '1.72',
    caretColor: 'var(--accent)'
  },
  '.cm-scroller': { lineHeight: '1.72' },
  '.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(108,182,255,0.15)'
  },
  '.cm-gutters': { display: 'none' }
})

const proseExtensions = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  indentOnInput(),
  closeBrackets(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  proseTheme,
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap
  ])
]

function toggleWrap(marker: string) {
  return (view: EditorView): boolean => {
    const newRanges = view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to)
      const isWrapped = text.length >= marker.length * 2 && text.startsWith(marker) && text.endsWith(marker)

      if (isWrapped) {
        const inner = text.slice(marker.length, text.length - marker.length)
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length)
        }
      }

      const insert = `${marker}${text}${marker}`
      return {
        changes: { from: range.from, to: range.to, insert },
        range:
          text.length === 0
            ? EditorSelection.cursor(range.from + marker.length)
            : EditorSelection.range(range.from, range.from + insert.length)
      }
    })
    view.dispatch(view.state.update(newRanges, { scrollIntoView: true }))
    return true
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function MarkdownEditor({
  value,
  filePath,
  vaultRoot,
  attachmentFolder,
  wikiLinkIndex,
  embedIndex,
  onNavigate,
  onChange
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    async function handlePaste(event: ClipboardEvent, view: EditorView): Promise<boolean> {
      const items = event.clipboardData?.items
      if (!items) return false

      const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
      if (!imageItem) return false

      const file = imageItem.getAsFile()
      if (!file) return false

      event.preventDefault()

      const ext = (imageItem.type.split('/')[1] || 'png').toLowerCase()
      const base64Data = await fileToBase64(file)
      const { relativeFromNote } = await api().vault.saveImage(filePath, base64Data, ext, vaultRoot, attachmentFolder)

      const insertion = `![](${relativeFromNote})`
      const pos = view.state.selection.main.from
      view.dispatch({
        changes: { from: pos, to: view.state.selection.main.to, insert: insertion },
        selection: { anchor: pos + insertion.length }
      })

      return true
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        ...proseExtensions,
        markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [GFM] }),
        EditorView.lineWrapping,
        livePreview({ filePath, vaultRoot, wikiLinkIndex, embedIndex, onNavigate }),
        keymap.of([
          { key: 'Mod-b', run: toggleWrap('**') },
          { key: 'Mod-i', run: toggleWrap('*') }
        ]),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            void handlePaste(event, view)
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString())
        })
      ]
    })

    const view = new EditorView({ state, parent: containerRef.current })
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="markdown-editor" />
}
