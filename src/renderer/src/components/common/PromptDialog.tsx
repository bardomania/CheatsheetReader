import { useState } from 'react'

interface PromptDialogProps {
  message: string
  defaultValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function PromptDialog({ message, defaultValue, onSubmit, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }

  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <form className="prompt-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <p>{message}</p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
        />
        <div className="prompt-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">OK</button>
        </div>
      </form>
    </div>
  )
}
