import { useState } from 'react'
import { api } from '../../lib/ipc'
import type { SearchResult } from '../../../../../electron/main/shared-types'

interface SearchPanelProps {
  rootPath: string
  onOpenFile: (filePath: string) => void
  onClose: () => void
}

export default function SearchPanel({ rootPath, onOpenFile, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'code'>('all')
  const [results, setResults] = useState<SearchResult[]>([])

  async function runSearch(q: string, m: 'all' | 'code'): Promise<void> {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    setResults(await api().search.query(rootPath, q, m))
  }

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3>Search</h3>
        <button className="btn btn-secondary btn-compact" onClick={onClose}>Close</button>
      </div>
      <input
        autoFocus
        type="text"
        placeholder="Search cheatsheets…"
        value={query}
        onChange={(e) => runSearch(e.target.value, mode)}
      />
      <div className="search-mode-toggle">
        <label>
          <input
            type="radio"
            name="search-mode"
            checked={mode === 'all'}
            onChange={() => {
              setMode('all')
              runSearch(query, 'all')
            }}
          />
          All text
        </label>
        <label>
          <input
            type="radio"
            name="search-mode"
            checked={mode === 'code'}
            onChange={() => {
              setMode('code')
              runSearch(query, 'code')
            }}
          />
          Code blocks only
        </label>
      </div>
      <ul className="search-results">
        {results.map((r) => (
          <li key={r.filePath} className="search-result-item" onClick={() => onOpenFile(r.filePath)}>
            {r.name}
          </li>
        ))}
      </ul>
      {query.trim() && results.length === 0 && <p className="empty-hint">No matches.</p>}
    </div>
  )
}
