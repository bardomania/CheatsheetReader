import { useEffect, useRef, useState } from 'react'
import { colorForConcept } from '../../lib/atlas'

interface FlagPickerDialogProps {
  fileName: string
  currentTags: string[]
  suggestedTags: string[]
  onSave: (tags: string[]) => void
  onCancel: () => void
}

export default function FlagPickerDialog({
  fileName,
  currentTags,
  suggestedTags,
  onSave,
  onCancel
}: FlagPickerDialogProps): React.ReactElement {
  const [tags, setTags] = useState<string[]>(currentTags)
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const inputLower = input.toLowerCase().trim()
  const suggestions = inputLower
    ? suggestedTags.filter(
        (t) => t.toLowerCase().includes(inputLower) && !tags.includes(t)
      )
    : suggestedTags.filter((t) => !tags.includes(t))

  function addTag(tag: string): void {
    const normalized = tag.trim()
    if (!normalized || tags.includes(normalized)) return
    setTags((prev) => [...prev, normalized])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string): void {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Escape') {
      if (showSuggestions) setShowSuggestions(false)
      else onCancel()
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <div className="prompt-modal flag-picker-modal" onClick={(e) => e.stopPropagation()}>
        <p className="flag-picker-title">Flags — <span className="flag-picker-filename">{fileName}</span></p>

        <div className="flag-picker-chips">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flag-chip"
              style={{ borderColor: colorForConcept(tag), '--flag-color': colorForConcept(tag) } as React.CSSProperties}
            >
              {tag}
              <button
                className="flag-chip-remove"
                onClick={() => removeTag(tag)}
                tabIndex={-1}
                aria-label={`Retirer ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && <span className="flag-picker-empty-chips">Aucun flag</span>}
        </div>

        <div className="flag-picker-input-wrap">
          <input
            ref={inputRef}
            className="flag-picker-input"
            type="text"
            placeholder="Ajouter un flag…"
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
          />
          {input.trim() && (
            <button
              className="btn btn-compact btn-secondary flag-picker-add-btn"
              onMouseDown={(e) => { e.preventDefault(); addTag(input) }}
            >
              Ajouter
            </button>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <ul className="flag-picker-suggestions">
              {suggestions.slice(0, 10).map((s) => (
                <li
                  key={s}
                  className="flag-picker-suggestion"
                  onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                >
                  <span
                    className="flag-suggestion-dot"
                    style={{ background: colorForConcept(s) }}
                  />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="prompt-actions">
          <button className="btn btn-secondary btn-compact" onClick={onCancel}>Annuler</button>
          <button className="btn btn-primary btn-compact" onClick={() => onSave(tags)}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
