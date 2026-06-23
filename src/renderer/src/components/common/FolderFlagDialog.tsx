import { useEffect, useRef, useState } from 'react'
import { colorForConcept } from '../../lib/atlas'

interface FolderFlagDialogProps {
  folderName: string
  fileCount: number
  suggestedTags: string[]
  onAssign: (flag: string) => void
  onCancel: () => void
}

export default function FolderFlagDialog({
  folderName,
  fileCount,
  suggestedTags,
  onAssign,
  onCancel
}: FolderFlagDialogProps): React.ReactElement {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const inputLower = input.toLowerCase().trim()
  const suggestions = inputLower
    ? suggestedTags.filter((t) => t.toLowerCase().includes(inputLower))
    : suggestedTags

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && input.trim()) { e.preventDefault(); onAssign(input.trim()) }
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <div className="prompt-modal flag-picker-modal" onClick={(e) => e.stopPropagation()}>
        <p className="flag-picker-title">
          Assigner un flag à <span className="flag-picker-filename">{fileCount} note{fileCount > 1 ? 's' : ''}</span> dans <span className="flag-picker-filename">{folderName}/</span>
        </p>

        <div className="flag-picker-input-wrap" style={{ marginTop: 12 }}>
          <input
            ref={inputRef}
            className="flag-picker-input"
            type="text"
            placeholder="Nom du flag (ex: Recon, AD, OSINT…)"
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul className="flag-picker-suggestions">
              {suggestions.slice(0, 10).map((s) => (
                <li
                  key={s}
                  className="flag-picker-suggestion"
                  onMouseDown={(e) => { e.preventDefault(); onAssign(s) }}
                >
                  <span className="flag-suggestion-dot" style={{ background: colorForConcept(s) }} />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {input.trim() && (
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, marginBottom: 0 }}>
            Le flag <strong style={{ color: 'var(--text)' }}>{input.trim()}</strong> sera ajouté aux notes qui ne l'ont pas déjà.
          </p>
        )}

        <div className="prompt-actions">
          <button className="btn btn-secondary btn-compact" onClick={onCancel}>Annuler</button>
          <button
            className="btn btn-primary btn-compact"
            disabled={!input.trim()}
            onClick={() => onAssign(input.trim())}
          >
            Assigner
          </button>
        </div>
      </div>
    </div>
  )
}
