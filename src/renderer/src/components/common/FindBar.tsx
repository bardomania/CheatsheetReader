import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/ipc'

interface FindBarProps {
  onClose: () => void
}

export default function FindBar({ onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    // Electron's findInPage highlights a match in the page, which can steal
    // focus from our input. Refocus after every result so typing stays fluid.
    return api().window.onFindResult((r) => {
      setResult(r)
      inputRef.current?.focus()
    })
  }, [])

  useEffect(() => {
    return () => {
      api().window.stopFindInPage()
    }
  }, [])

  useEffect(() => {
    if (!query) {
      setResult(null)
      api().window.stopFindInPage()
      return
    }
    api().window.findInPage(query, { forward: true })
  }, [query])

  function findNext(forward: boolean): void {
    if (!query) return
    api().window.findInPage(query, { forward, findNext: true })
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      findNext(!e.shiftKey)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in this page…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="find-bar-count">
        {query ? (result && result.matches > 0 ? `${result.activeMatchOrdinal}/${result.matches}` : '0/0') : ''}
      </span>
      <div className="find-bar-sep" />
      <button className="btn btn-secondary btn-compact" onClick={() => findNext(false)} disabled={!query} title="Previous (Shift+Enter)">
        ↑
      </button>
      <button className="btn btn-secondary btn-compact" onClick={() => findNext(true)} disabled={!query} title="Next (Enter)">
        ↓
      </button>
      <div className="find-bar-sep" />
      <button className="btn btn-secondary btn-compact" onClick={onClose} title="Close (Escape)">
        ×
      </button>
    </div>
  )
}
