import { useEffect, useState } from 'react'
import { api } from '../../lib/ipc'
import { useVariablesStore } from '../../state/variablesStore'
import type { AttachmentFolderMode, ExposureStatus, VaultSettings } from '../../../../../electron/main/shared-types'

const ATTACHMENT_MODE_OPTIONS: { value: AttachmentFolderMode; label: string }[] = [
  { value: 'vault-folder', label: 'Vault folder' },
  { value: 'fixed-folder', label: 'In the folder specified below' },
  { value: 'same-folder', label: 'Same folder as current file' },
  { value: 'subfolder', label: 'In subfolder under current folder' }
]

const SECTIONS = ['Editor', 'Attachments', 'Variables', 'Shortcuts', 'Network exposure'] as const
type Section = (typeof SECTIONS)[number]

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

const NAMED_KEYS: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Enter: 'Return'
}

function mapKey(e: KeyboardEvent): string | null {
  if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) return e.key.toUpperCase()
  if (NAMED_KEYS[e.key]) return NAMED_KEYS[e.key]
  if (/^F\d{1,2}$/.test(e.key)) return e.key
  return null
}

function buildAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.metaKey && !e.ctrlKey) parts.push('Super')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (parts.length === 0) return null

  const key = mapKey(e)
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

interface ShortcutRecorderProps {
  value: string
  onSave: (accelerator: string) => Promise<void>
}

function ShortcutRecorder({ value, onSave }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!recording) return

    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()
      if (MODIFIER_KEYS.has(e.key)) return
      const accel = buildAccelerator(e)
      if (!accel) {
        setError('Add at least one modifier key (Ctrl, Alt, Shift or Win) plus a regular key.')
        return
      }
      setError(null)
      setPending(accel)
      setRecording(false)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording])

  async function handleSave(accelerator: string): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await onSave(accelerator)
      setPending(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="shortcut-recorder">
      <div className="shortcut-recorder-row">
        <span className="shortcut-current">{recording ? 'Press a key combo…' : pending ?? value}</span>
        {!recording && !pending && (
          <button className="btn btn-secondary btn-compact" onClick={() => setRecording(true)}>
            Change
          </button>
        )}
        {recording && (
          <button className="btn btn-secondary btn-compact" onClick={() => setRecording(false)}>
            Cancel
          </button>
        )}
        {pending && !recording && (
          <>
            <button className="btn btn-primary btn-compact" disabled={saving} onClick={() => handleSave(pending)}>
              Save
            </button>
            <button className="btn btn-secondary btn-compact" onClick={() => setPending(null)}>
              Cancel
            </button>
          </>
        )}
      </div>
      {error && <div className="exposure-error">{error}</div>}
    </div>
  )
}

interface ExposurePanelProps {
  currentVaultRoot: string | null
  vaultSettings: VaultSettings
  onUpdateVaultSettings: (partial: Partial<VaultSettings>) => void
  onClose: () => void
}

export default function ExposurePanel({
  currentVaultRoot,
  vaultSettings,
  onUpdateVaultSettings,
  onClose
}: ExposurePanelProps) {
  const [activeSection, setActiveSection] = useState<Section>('Editor')
  const [navOpen, setNavOpen] = useState(false)
  const [status, setStatus] = useState<ExposureStatus | null>(null)
  const [bindAddress, setBindAddress] = useState('127.0.0.1')
  const [port, setPort] = useState(4756)
  const [password, setPassword] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toggleShortcut, setToggleShortcut] = useState('')

  const setValues = useVariablesStore((s) => s.setValues)
  const upsertContext = useVariablesStore((s) => s.upsertContext)

  async function refresh(): Promise<void> {
    const s = await api().exposure.getStatus()
    setStatus(s)
    setBindAddress(s.bindAddress)
    setPort(s.port)
  }

  useEffect(() => {
    refresh()
    api().window.getToggleShortcut().then(setToggleShortcut)
  }, [])

  async function handleSaveBindConfig(): Promise<void> {
    await api().exposure.setBindConfig(bindAddress, port)
    await refresh()
  }

  async function handleUseCurrentVault(): Promise<void> {
    if (!currentVaultRoot) return
    await api().exposure.setVaultRoot(currentVaultRoot)
    await refresh()
  }

  async function handleSetPassword(): Promise<void> {
    if (!password) return
    await api().exposure.setPassword(password)
    setPassword('')
    await refresh()
  }

  async function handleSetBearerToken(): Promise<void> {
    await api().exposure.setBearerToken(bearerToken || null)
    await refresh()
  }

  async function handleStart(): Promise<void> {
    setError(null)
    const result = await api().exposure.start()
    if (!result.ok) setError(result.error)
    await refresh()
  }

  async function handleStop(): Promise<void> {
    await api().exposure.stop()
    await refresh()
  }

  async function handleExport(): Promise<void> {
    if (!currentVaultRoot) return
    await api().variables.exportJson(currentVaultRoot)
  }

  async function handleImport(): Promise<void> {
    if (!currentVaultRoot) return
    const result = await api().variables.importJson(currentVaultRoot)
    if (!result) return
    setValues(result.values)
    for (const context of result.contexts) upsertContext(context)
  }

  return (
    <div className="exposure-panel">
      <div className="exposure-header">
        <h2>Settings</h2>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="settings-shell">
        <div className="settings-toolbar">
          <button className="btn btn-secondary btn-icon" title="Sections" onClick={() => setNavOpen((v) => !v)}>
            ☰
          </button>
          <span className="settings-current-section">{activeSection}</span>

          {navOpen && (
            <>
              <div className="context-menu-backdrop" onClick={() => setNavOpen(false)} />
              <div className="settings-nav-dropdown">
                {SECTIONS.map((section) => (
                  <button
                    key={section}
                    className={`settings-nav-item${activeSection === section ? ' active' : ''}`}
                    onClick={() => {
                      setActiveSection(section)
                      setNavOpen(false)
                    }}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="settings-content">
          {activeSection === 'Editor' && (
            <section>
              <h3 className="settings-section-title">Editor</h3>
              <label className="autosave-toggle">
                <input
                  type="checkbox"
                  checked={vaultSettings.autosaveEnabled}
                  disabled={!currentVaultRoot}
                  onChange={(e) => onUpdateVaultSettings({ autosaveEnabled: e.target.checked })}
                />
                Autosave every
                <input
                  type="number"
                  min={5}
                  className="autosave-interval"
                  disabled={!currentVaultRoot}
                  value={Math.round(vaultSettings.autosaveIntervalMs / 1000)}
                  onChange={(e) =>
                    onUpdateVaultSettings({ autosaveIntervalMs: Math.max(5, Number(e.target.value)) * 1000 })
                  }
                />
                seconds
              </label>
              {!currentVaultRoot && <p className="empty-hint">Open a vault to configure autosave.</p>}
            </section>
          )}

          {activeSection === 'Attachments' && (
            <section>
              <h3 className="settings-section-title">Attachments</h3>
              <div className="exposure-field">
                <label>Default location for new attachments</label>
                <select
                  value={vaultSettings.attachmentFolder.mode}
                  disabled={!currentVaultRoot}
                  onChange={(e) =>
                    onUpdateVaultSettings({
                      attachmentFolder: {
                        ...vaultSettings.attachmentFolder,
                        mode: e.target.value as AttachmentFolderMode
                      }
                    })
                  }
                >
                  {ATTACHMENT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {vaultSettings.attachmentFolder.mode !== 'same-folder' && (
                <div className="exposure-field">
                  <label>Folder name</label>
                  <input
                    type="text"
                    value={vaultSettings.attachmentFolder.folderName}
                    disabled={!currentVaultRoot}
                    onChange={(e) =>
                      onUpdateVaultSettings({
                        attachmentFolder: { ...vaultSettings.attachmentFolder, folderName: e.target.value }
                      })
                    }
                  />
                </div>
              )}
              {!currentVaultRoot && <p className="empty-hint">Open a vault to configure attachments.</p>}
            </section>
          )}

          {activeSection === 'Variables' && (
            <section>
              <h3 className="settings-section-title">Variables</h3>
              <p className="exposure-intro">
                Export the current vault&apos;s variables and profiles to a JSON file, or import a previously
                exported one.
              </p>
              <div className="variables-io">
                <button className="btn btn-secondary" onClick={handleExport} disabled={!currentVaultRoot}>
                  Export JSON
                </button>
                <button className="btn btn-secondary" onClick={handleImport} disabled={!currentVaultRoot}>
                  Import JSON
                </button>
              </div>
              {!currentVaultRoot && <p className="empty-hint">Open a vault to export or import variables.</p>}
            </section>
          )}

          {activeSection === 'Shortcuts' && (
            <section>
              <h3 className="settings-section-title">Shortcuts</h3>
              <p className="exposure-intro">
                Show/hide the window from anywhere, even when another app is focused. Press it once to bring the
                window to the center of the screen, press it again to hide it instantly.
              </p>
              <div className="exposure-field">
                <label>Show/hide window</label>
                <ShortcutRecorder
                  value={toggleShortcut}
                  onSave={async (accelerator) => {
                    const result = await api().window.setToggleShortcut(accelerator)
                    if (!result.ok) throw new Error(result.error ?? 'Could not save this shortcut')
                    setToggleShortcut(accelerator)
                  }}
                />
              </div>
            </section>
          )}

          {activeSection === 'Network exposure' && (
            <section>
              <h3 className="settings-section-title">Network exposure</h3>
              <p className="exposure-intro">
                By default the app is local-only. Enabling exposure starts an embedded HTTP server scoped to a
                single vault you choose below — every request is clamped to that vault, even with valid
                credentials. Binding beyond localhost additionally requires an admin password.
              </p>

              {status?.warning && <div className="exposure-warning">⚠ {status.warning}</div>}
              {error && <div className="exposure-error">{error}</div>}

              <div className="exposure-status">
                Status: <strong>{status?.running ? 'Running' : 'Stopped'}</strong>
              </div>

              <div className="exposure-field">
                <label>Vault exposed by the server</label>
                <div className="exposure-vault-row">
                  <span className="exposure-vault-path">{status?.vaultRoot ?? '(none configured)'}</span>
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={handleUseCurrentVault}
                    disabled={!currentVaultRoot || status?.running}
                  >
                    Use currently open vault
                  </button>
                </div>
              </div>

              <div className="exposure-field">
                <label>Bind address</label>
                <input
                  type="text"
                  value={bindAddress}
                  onChange={(e) => setBindAddress(e.target.value)}
                  disabled={status?.running}
                />
              </div>
              <div className="exposure-field">
                <label>Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  disabled={status?.running}
                />
              </div>
              <button className="btn btn-secondary" onClick={handleSaveBindConfig} disabled={status?.running}>
                Save bind settings
              </button>

              <div className="exposure-field">
                <label>Admin password {status?.hasPassword && '(set)'}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-secondary" onClick={handleSetPassword} disabled={!password}>
                Set password
              </button>

              <div className="exposure-field">
                <label>Static bearer token (optional) {status?.hasBearerToken && '(set)'}</label>
                <input type="text" value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} />
              </div>
              <button className="btn btn-secondary" onClick={handleSetBearerToken}>
                Set bearer token
              </button>

              <div className="exposure-actions">
                {status?.running ? (
                  <button className="btn btn-danger" onClick={handleStop}>
                    Stop server
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleStart} disabled={!status?.vaultRoot}>
                    Start server
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
