interface ConfirmDialogProps {
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  message,
  confirmLabel = 'OK',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <div className="prompt-backdrop" onClick={onCancel}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="prompt-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
