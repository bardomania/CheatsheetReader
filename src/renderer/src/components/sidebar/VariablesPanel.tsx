import { useState } from 'react'
import { useVariablesStore } from '../../state/variablesStore'
import { useVaultStore } from '../../state/vaultStore'
import { api } from '../../lib/ipc'

const NAME_RE = /^[a-zA-Z_]\w*$/

export default function VariablesPanel() {
  const rootPath = useVaultStore((s) => s.rootPath)
  const usage = useVariablesStore((s) => s.usage)
  const values = useVariablesStore((s) => s.values)
  const setValue = useVariablesStore((s) => s.setValue)
  const setValues = useVariablesStore((s) => s.setValues)
  const addVariable = useVariablesStore((s) => s.addVariable)
  const removeVariable = useVariablesStore((s) => s.removeVariable)
  const renameVariable = useVariablesStore((s) => s.renameVariable)
  const contexts = useVariablesStore((s) => s.contexts)
  const activeContext = useVariablesStore((s) => s.activeContext)
  const setActiveContext = useVariablesStore((s) => s.setActiveContext)
  const upsertContext = useVariablesStore((s) => s.upsertContext)
  const removeContext = useVariablesStore((s) => s.removeContext)

  const [newContextName, setNewContextName] = useState('')
  const [newVarName, setNewVarName] = useState('')
  const [renamingName, setRenamingName] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const names = Object.keys(values).sort()
  const undeclared = Object.keys(usage)
    .filter((name) => !(name in values))
    .sort()

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

  async function handleLoadContext(context: { name: string; values: Record<string, string> }): Promise<void> {
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
        <button className="btn btn-secondary btn-compact" onClick={handleAddVariable} disabled={!NAME_RE.test(newVarName.trim())}>
          Add
        </button>
      </div>

      {names.length === 0 ? (
        <p className="empty-hint">No variables defined yet — add one above.</p>
      ) : (
        <ul className="variables-list">
          {names.map((name) => {
            const isMissing = !values[name]
            const usageCount = usage[name]?.length ?? 0
            return (
              <li key={name} className="variables-list-item">
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
                <div className="variables-list-row">
                  <input
                    type="text"
                    value={values[name] ?? ''}
                    placeholder="(unset)"
                    onChange={(e) => setValue(name, e.target.value)}
                  />
                  <button className="btn btn-secondary btn-compact" title="Rename" onClick={() => startRename(name)}>
                    ✎
                  </button>
                  <button className="btn btn-danger btn-compact" title="Delete" onClick={() => handleDeleteVariable(name)}>
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}


      <h3 className="panel-subtitle">Profiles</h3>
      <p className="empty-hint">Edits save automatically into the active profile — no save button needed.</p>
      <div className="context-new">
        <input
          type="text"
          placeholder="New profile name"
          value={newContextName}
          onChange={(e) => setNewContextName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
        />
        <button className="btn btn-secondary btn-compact" onClick={handleCreateProfile} disabled={!newContextName.trim()}>
          Create profile
        </button>
      </div>
      {contexts.length > 0 && (
        <ul className="context-list">
          {contexts.map((context) => {
            const isActive = context.name === activeContext
            return (
              <li key={context.name} className={`context-list-item${isActive ? ' active' : ''}`}>
                <span>
                  {context.name}
                  {isActive && <span className="context-active-badge"> (active)</span>}
                </span>
                <div className="context-actions">
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={() => handleLoadContext(context)}
                    disabled={isActive}
                  >
                    Switch
                  </button>
                  <button
                    className="btn btn-danger btn-compact"
                    onClick={() => handleDeleteContext(context.name)}
                    disabled={isActive}
                    title={isActive ? 'Switch to another profile before deleting this one' : undefined}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
