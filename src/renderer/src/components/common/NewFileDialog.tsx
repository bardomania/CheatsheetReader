import { useEffect, useState } from 'react'
import { api } from '../../lib/ipc'

interface NewFileDialogProps {
  onSubmit: (name: string, template: string) => void
  onCancel: () => void
}

type FileType = 'markdown' | 'canvas' | 'excalidraw'

export default function NewFileDialog({ onSubmit, onCancel }: NewFileDialogProps) {
  const [name, setName] = useState('')
  const [fileType, setFileType] = useState<FileType>('markdown')
  const [selectedTemplate, setSelectedTemplate] = useState('Empty')
  const [templates, setTemplates] = useState<string[]>(['Empty'])

  useEffect(() => {
    api()
      .templates.list()
      .then(setTemplates)
  }, [])

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    if (!name.trim()) return
    const template =
      fileType === 'canvas' ? '__canvas__' :
      fileType === 'excalidraw' ? '__excalidraw__' :
      selectedTemplate
    onSubmit(name.trim(), template)
  }

  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <form className="prompt-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <p>New file name:</p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        />
        <p>Type:</p>
        <div className="new-file-type-toggle">
          <label className={`new-file-type-option${fileType === 'markdown' ? ' active' : ''}`}>
            <input type="radio" name="file-type" checked={fileType === 'markdown'} onChange={() => setFileType('markdown')} />
            Markdown
          </label>
          <label className={`new-file-type-option${fileType === 'canvas' ? ' active' : ''}`}>
            <input type="radio" name="file-type" checked={fileType === 'canvas'} onChange={() => setFileType('canvas')} />
            Canvas
          </label>
          <label className={`new-file-type-option${fileType === 'excalidraw' ? ' active' : ''}`}>
            <input type="radio" name="file-type" checked={fileType === 'excalidraw'} onChange={() => setFileType('excalidraw')} />
            Excalidraw
          </label>
        </div>
        {fileType === 'markdown' && (
          <>
            <p>Template:</p>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}
        <div className="prompt-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create</button>
        </div>
      </form>
    </div>
  )
}
