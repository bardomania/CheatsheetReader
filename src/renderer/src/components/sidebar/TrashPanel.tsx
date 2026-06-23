import type { TrashManifest } from '../../../../../electron/main/shared-types'

interface TrashPanelProps {
  entries: TrashManifest[]
  onRestore: (id: string) => void
  onPurge: (id: string) => void
  onClose: () => void
}

export default function TrashPanel({ entries, onRestore, onPurge, onClose }: TrashPanelProps) {
  return (
    <div className="trash-panel">
      <div className="trash-panel-header">
        <h3>Trash</h3>
        <button className="btn btn-secondary btn-compact" onClick={onClose}>Close</button>
      </div>
      {entries.length === 0 ? (
        <p className="empty-hint">Trash is empty.</p>
      ) : (
        <ul className="trash-list">
          {entries.map((entry) => (
            <li key={entry.id} className="trash-list-item">
              <span>
                {entry.name} <span className="trash-meta">({entry.type})</span>
              </span>
              <div className="trash-actions">
                <button className="btn btn-secondary btn-compact" onClick={() => onRestore(entry.id)}>Restore</button>
                <button className="btn btn-danger btn-compact" onClick={() => onPurge(entry.id)}>Delete forever</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
