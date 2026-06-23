import { useRef, useState } from 'react'
import { getFileTags, setFileTags } from '../../lib/frontmatter'
import { colorForConcept } from '../../lib/atlas'

interface FlagsBarProps {
  content: string
  onChange: (newContent: string) => void
}

export default function FlagsBar({ content, onChange }: FlagsBarProps): React.ReactElement {
  const tags = getFileTags(content)
  const [adding, setAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function removeTag(tag: string): void {
    const newTags = tags.filter((t) => t !== tag)
    onChange(setFileTags(content, newTags))
  }

  function commitAdd(): void {
    const normalized = inputValue.trim()
    if (normalized && !tags.includes(normalized)) {
      onChange(setFileTags(content, [...tags, normalized]))
    }
    setInputValue('')
    setAdding(false)
  }

  function handleInputKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); commitAdd() }
    else if (e.key === 'Escape') { setInputValue(''); setAdding(false) }
  }

  function startAdding(): void {
    setAdding(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="flags-bar">
      <span className="flags-bar-label">Flags</span>
      <div className="flags-bar-chips">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flag-chip flag-chip-sm"
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

        {adding ? (
          <input
            ref={inputRef}
            className="flags-bar-input"
            type="text"
            placeholder="Nouveau flag…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={commitAdd}
          />
        ) : (
          <button className="flags-bar-add-btn" onClick={startAdding} title="Ajouter un flag">
            + flag
          </button>
        )}
      </div>
    </div>
  )
}
