import { useRef, useState } from 'react'
import { useVariablesStore } from '../../state/variablesStore'
import { useVaultStore } from '../../state/vaultStore'
import { api } from '../../lib/ipc'
import type { VariableContext } from '../../../../electron/main/shared-types'

const NAME_RE = /^[a-zA-Z_]\w*$/

// --- VariableCombobox ---

interface ComboboxProps {
  value: string
  presets: string[]
  onChange: (v: string) => void
  onPresetsChange: (presets: string[]) => void
}

function VariableCombobox({ value, presets, onChange, onPresetsChange }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? presets.filter((p) => p.toLowerCase().includes(value.trim().toLowerCase()))
    : presets

  const canAddPreset = value.trim() !== '' && !presets.includes(value.trim())

  function handleBlur(): void {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false)
      }
    }, 100)
  }

  return (
    <div className="var-combobox" ref={containerRef} onBlur={handleBlur}>
      <div className="var-combobox-input-row">
        <input
          type="text"
          value={value}
          placeholder="(unset)"
          onFocus={() => { if (presets.length > 0) setOpen(true) }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && open && filtered.length > 0) {
              onChange(filtered[0])
              setOpen(false)
            }
            if (e.key === 'ArrowDown' && !open && presets.length > 0) setOpen(true)
          }}
        />
        {canAddPreset && (
          <button
            className="btn btn-secondary btn-compact"
            title={`Save "${value.trim()}" as preset`}
            onMouseDown={(e) => { e.preventDefault(); onPresetsChange([...presets, value.trim()]) }}
            tabIndex={-1}
          >+</button>
        )}
        {presets.length > 0 && (
          <button
            className="btn btn-secondary btn-compact"
            onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
            tabIndex={-1}
            title="Show presets"
          >▾</button>
        )}
      </div>
      {open && presets.length > 0 && (
        <div className="var-combobox-dropdown">
          {filtered.map((preset) => (
            <div
              key={preset}
              className={`var-combobox-option${preset === value ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(preset); setOpen(false) }}
            >
              <span className="var-combobox-option-text">{preset}</span>
              <button
                className="var-combobox-remove"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPresetsChange(presets.filter((p) => p !== preset))
                }}
                title="Remove preset"
              >×</button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="var-combobox-empty">No match for "{value}"</div>
          )}
        </div>
      )}
    </div>
  )
}

// --- ProfileSelector ---

interface ProfileSelectorProps {
  contexts: VariableContext[]
  activeContext: string | null
  onSwitch: (ctx: VariableContext) => void
  onDelete: (name: string) => void
}

function ProfileSelector({ contexts, activeContext, onSwitch, onDelete }: ProfileSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? contexts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contexts

  function handleBlur(): void {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false)
        setSearch('')
      }
    }, 100)
  }

  function openDropdown(): void {
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  return (
    <div className="profile-selector" ref={containerRef} onBlur={handleBlur}>
      <button
        className="profile-selector-trigger"
        onClick={() => (open ? setOpen(false) : openDropdown())}
      >
        <span className="profile-selector-label">{activeContext ?? '—'}</span>
        <span>▾</span>
      </button>
      {open && (
        <div className="profile-selector-dropdown">
          <input
            ref={searchRef}
            type="text"
            className="profile-selector-search"
            placeholder="Search profiles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setSearch('') } }}
          />
          <div className="profile-selector-list">
            {filtered.map((ctx) => (
              <div
                key={ctx.name}
                className={`profile-selector-item${ctx.name === activeContext ? ' active' : ''}`}
              >
                <span
                  className="profile-selector-name"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (ctx.name !== activeContext) onSwitch(ctx)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  {ctx.name}
                </span>
                <button
                  className="btn btn-danger btn-compact"
                  disabled={ctx.name === activeContext}
                  onMouseDown={(e) => { e.preventDefault(); onDelete(ctx.name) }}
                  title={ctx.name === activeContext ? 'Switch first' : 'Delete'}
                >×</button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="profile-selector-empty">No match</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main VariablesPanel ---

export default function VariablesPanel() {
  const rootPath = useVaultStore((s) => s.rootPath)
  const usage = useVariablesStore((s) => s.usage)
  const values = useVariablesStore((s) => s.values)
  const order = useVariablesStore((s) => s.order)
  const presets = useVariablesStore((s) => s.presets)
  const setValue = useVariablesStore((s) => s.setValue)
  const setValues = useVariablesStore((s) => s.setValues)
  const addVariable = useVariablesStore((s) => s.addVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const renameVariable = useVariablesStore((s) => s.renameVariable)
  const reorderVariables = useVariablesStore((s) => s.reorderVariables)
  const setVariablePresets = useVariablesStore((s) => s.setVariablePresets)
  const contexts = useVariablesStore((s) => s.contexts)
  const activeContext = useVariablesStore((s) => s.activeContext)
  const setActiveContext = useVariablesStore((s) => s.setActiveContext)
  const upsertContext = useVariablesStore((s) => s.upsertContext)
  const removeContext = useVariablesStore((s) => s.removeContext)

  const [newContextName, setNewContextName] = useState('')
  const [newVarName, setNewVarName] = useState('')
  const [renamingName, setRenamingName] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function handleAddVariable(): void {
    const name = newVarName.trim()
    if (!NAME_RE.test(name)) return
    addVariable(name)
    setNewVarName('')
  }

  function startRename(name: string): void {
    setRenamingName(name)
    setRenameDraft(name)
  }

  function commitRename(): void {
    if (!renamingName) return
    const next = renameDraft.trim()
    if (NAME_RE.test(next) && next !== renamingName) renameVariable(renamingName, next)
    setRenamingName(null)
  }

  function handleDeleteVariable(name: string): void {
    if (!window.confirm(`Delete variable "${name}"? Existing {{${name}}} references will show as unset.`)) return
    removeVariable(name)
  }

  async function activateContext(name: string, contextValues: Record<string, string>): Promise<void> {
    setValues(contextValues)
    setActiveContext(name)
    if (!rootPath) return
    const current = await api().vaultSettings.read(rootPath)
    await api().vaultSettings.write(rootPath, { ...current, activeContext: name })
  }

  async function handleCreateProfile(): Promise<void> {
    if (!rootPath || !newContextName.trim()) return
    const name = newContextName.trim()
    const context = await api().variables.saveContext(rootPath, name, values)
    upsertContext(context)
    setNewContextName('')
    await activateContext(context.name, context.values)
  }

  async function handleDeleteContext(name: string): Promise<void> {
    if (!rootPath || name === activeContext) return
    await api().variables.deleteContext(rootPath, name)
    removeContext(name)
  }

  return (
    <div>
      <div className="variables-new">
        <input
          type="text"
          placeholder="New variable name"
          value={newVarName}
          onChange={(e) => setNewVarName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
        />
        <button
          className="btn btn-secondary btn-compact"
          onClick={handleAddVariable}
          disabled={!NAME_RE.test(newVarName.trim())}
        >Add</button>
      </div>

      {order.length === 0 ? (
        <p className="empty-hint">No variables defined yet — add one above.</p>
      ) : (
        <ul className="variables-list">
          {order.map((name, i) => {
            const isMissing = !values[name]
            const usageCount = usage[name]?.length ?? 0
            const isDragOver = dragOverIdx === i && dragFromIdx !== i
            return (
              <li
                key={name}
                className={`variables-list-item${isDragOver ? ' drag-over' : ''}`}
                draggable
                onDragStart={() => setDragFromIdx(i)}
                onDragEnter={(e) => { e.preventDefault(); setDragOverIdx(i) }}
                onDragLeave={() => setDragOverIdx(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFromIdx !== null && dragFromIdx !== i) reorderVariables(dragFromIdx, i)
                  setDragFromIdx(null)
                  setDragOverIdx(null)
                }}
                onDragEnd={() => { setDragFromIdx(null); setDragOverIdx(null) }}
              >
                <div className="var-header">
                  <span className="var-drag-handle" title="Drag to reorder">⠿</span>
                  {renamingName === name ? (
                    <input
                      autoFocus
                      type="text"
                      className="variables-rename-input"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingName(null)
                      }}
                      onBlur={commitRename}
                    />
                  ) : (
                    <label
                      className={`variables-list-label${isMissing ? ' missing' : ''}`}
                      title={usageCount > 0 ? `Used in ${usageCount} file(s)` : 'Not referenced in any file yet'}
                      onDoubleClick={() => startRename(name)}
                    >
                      {name}
                      {isMissing && <span className="variables-warning"> ⚠</span>}
                    </label>
                  )}
                  <div className="var-actions">
                    <button className="btn btn-secondary btn-compact" title="Rename" onClick={() => startRename(name)}>✎</button>
                    <button className="btn btn-danger btn-compact" title="Delete" onClick={() => handleDeleteVariable(name)}>×</button>
                  </div>
                </div>
                <VariableCombobox
                  value={values[name] ?? ''}
                  presets={presets[name] ?? []}
                  onChange={(v) => setValue(name, v)}
                  onPresetsChange={(p) => setVariablePresets(name, p)}
                />
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="panel-subtitle">Profiles</h3>
      <p className="empty-hint">Edits auto-save to the active profile.</p>

      {contexts.length > 0 && (
        <ProfileSelector
          contexts={contexts}
          activeContext={activeContext}
          onSwitch={(ctx) => activateContext(ctx.name, ctx.values)}
          onDelete={handleDeleteContext}
        />
      )}

      <div className="context-new">
        <input
          type="text"
          placeholder="New profile name"
          value={newContextName}
          onChange={(e) => setNewContextName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
        />
        <button
          className="btn btn-secondary btn-compact"
          onClick={handleCreateProfile}
          disabled={!newContextName.trim()}
        >Create</button>
      </div>
    </div>
  )
}
