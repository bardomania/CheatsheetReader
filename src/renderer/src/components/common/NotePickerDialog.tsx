import { useEffect, useRef, useState } from 'react'
import type { VaultTreeNode } from '../../../../../electron/main/shared-types'

interface NotePickerDialogProps {
  mode: 'file' | 'url'
  vaultRoot: string
  tree: VaultTreeNode[]
  onSubmit: (value: string) => void
  onCancel: () => void
}

function flattenTree(nodes: VaultTreeNode[], vaultRoot: string): { name: string; rel: string }[] {
  const results: { name: string; rel: string }[] = []
  const prefix = vaultRoot.endsWith('/') || vaultRoot.endsWith('\\') ? vaultRoot : vaultRoot + '/'

  function visit(items: VaultTreeNode[]): void {
    for (const node of items) {
      if (node.type === 'file') {
        const rel = node.path.startsWith(prefix)
          ? node.path.slice(prefix.length).replace(/\\/g, '/')
          : node.path.replace(/\\/g, '/')
        results.push({ name: node.name, rel })
      } else if (node.children) {
        visit(node.children)
      }
    }
  }

  visit(nodes)
  return results
}

export default function NotePickerDialog({
  mode,
  vaultRoot,
  tree,
  onSubmit,
  onCancel
}: NotePickerDialogProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const allFiles = flattenTree(tree, vaultRoot)

  const q = query.toLowerCase().trim()
  const filtered =
    q.length === 0
      ? allFiles
      : allFiles.filter(
          (f) => f.name.toLowerCase().includes(q) || f.rel.toLowerCase().includes(q)
        )

  useEffect(() => {
    setSelectedIndex(-1)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && filtered[selectedIndex]) {
        pickFile(filtered[selectedIndex].rel)
      } else if (mode === 'url' && value.trim()) {
        onSubmit(value.trim())
      } else if (mode === 'file' && query.trim()) {
        onSubmit(query.trim())
      }
    }
  }

  function pickFile(rel: string): void {
    if (mode === 'file') {
      onSubmit(rel)
    } else {
      setValue(rel)
      setQuery('')
      inputRef.current?.focus()
    }
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const final = mode === 'url' ? value.trim() : query.trim()
    if (final) onSubmit(final)
  }

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const isUrl = mode === 'url'
  const title = isUrl ? 'Lien URL' : 'Sélectionner un fichier'
  const placeholder = isUrl ? 'https://...' : 'Rechercher une note...'

  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <form
        className="prompt-modal note-picker-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <p>{title}</p>

        {isUrl && (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            className="note-picker-url-input"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}

        <div className="note-picker-search-row">
          <input
            ref={isUrl ? undefined : inputRef}
            autoFocus={!isUrl}
            type="text"
            className="note-picker-search-input"
            placeholder={isUrl ? 'Chercher parmi les notes...' : placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <ul ref={listRef} className="note-picker-list">
          {filtered.length === 0 && (
            <li className="note-picker-empty">Aucun résultat</li>
          )}
          {filtered.map((f, i) => (
            <li
              key={f.rel}
              className={`note-picker-item${i === selectedIndex ? ' note-picker-item-selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pickFile(f.rel) }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="note-picker-item-name">{f.name}</span>
              <span className="note-picker-item-path">{f.rel}</span>
            </li>
          ))}
        </ul>

        <div className="prompt-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isUrl ? !value.trim() : !query.trim() && selectedIndex < 0}
          >
            OK
          </button>
        </div>
      </form>
    </div>
  )
}
