import { useEffect, useRef, useState } from 'react'
import type { VaultHistoryEntry } from '../../../../../electron/main/shared-types'

interface VaultSwitcherProps {
  currentVaultPath: string | null
  recentVaults: VaultHistoryEntry[]
  onSwitchVault: (path: string) => void
  onOpenNew: () => void
  onRemoveVault: (path: string) => void
}

function vaultName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

export default function VaultSwitcher({
  currentVaultPath,
  recentVaults,
  onSwitchVault,
  onOpenNew,
  onRemoveVault
}: VaultSwitcherProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="vault-switcher" ref={ref}>
      {open && (
        <div className="vault-switcher-dropdown">
          <button
            className="vault-switcher-open-btn"
            onClick={() => { setOpen(false); onOpenNew() }}
          >
            + Open folder...
          </button>
          {recentVaults.length > 0 && <div className="vault-switcher-divider" />}
          {recentVaults.map((entry) => (
            <div
              key={entry.path}
              className={`vault-switcher-entry${entry.path === currentVaultPath ? ' vault-switcher-entry-active' : ''}`}
            >
              <button
                className="vault-switcher-entry-btn"
                onClick={() => {
                  setOpen(false)
                  if (entry.path !== currentVaultPath) onSwitchVault(entry.path)
                }}
                title={entry.path}
              >
                <span className="vault-switcher-entry-name">{vaultName(entry.path)}</span>
                {entry.path === currentVaultPath && <span className="vault-switcher-current-dot" />}
              </button>
              <button
                className="vault-switcher-remove-btn"
                onClick={(e) => { e.stopPropagation(); onRemoveVault(entry.path) }}
                title="Remove from history"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="vault-switcher-bar" onClick={() => setOpen((o) => !o)}>
        <span className="vault-switcher-bar-icon">⊙</span>
        <span className="vault-switcher-bar-name">
          {currentVaultPath ? vaultName(currentVaultPath) : 'No vault open'}
        </span>
        <span className="vault-switcher-bar-chevron">{open ? '▾' : '▴'}</span>
      </button>
    </div>
  )
}
