import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './lib/ipc'
import { useVaultStore } from './state/vaultStore'
import { useVariablesStore } from './state/variablesStore'
import FileTree from './components/sidebar/FileTree'
import VariablesPanel from './components/sidebar/VariablesPanel'
import TrashPanel from './components/sidebar/TrashPanel'
import SearchPanel from './components/sidebar/SearchPanel'
import CommandsView from './components/editor/CommandsView'
import AtlasView from './components/atlas/AtlasView'
import PromptDialog from './components/common/PromptDialog'
import ConfirmDialog from './components/common/ConfirmDialog'
import NewFileDialog from './components/common/NewFileDialog'
import MarkdownPreview from './components/editor/MarkdownPreview'
import MarkdownEditor from './components/editor/MarkdownEditor'
import CanvasView from './components/canvas/CanvasView'
import HelpPage from './components/help/HelpPage'
import ExposurePanel from './components/common/ExposurePanel'
import FindBar from './components/common/FindBar'
import FlagsBar from './components/editor/FlagsBar'
import FolderFlagDialog from './components/common/FolderFlagDialog'
import { getFileTags, setFileTags } from './lib/frontmatter'
import { buildEmbedIndex, buildWikiLinkIndex } from './lib/wikiLinks'
import { vaultAssetUrl } from './lib/vaultAssetUrl'
import { toggleTaskListLine } from './lib/taskList'
import type { VaultSettings, TrashManifest, ExposureStatus } from '../../../electron/main/shared-types'

interface Tab {
  path: string
  content: string
  draft: string
  mode: 'read' | 'edit' | 'commands'
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

function extensionOf(filePath: string): string {
  const idx = filePath.lastIndexOf('.')
  return idx === -1 ? '' : filePath.slice(idx + 1).toLowerCase()
}

const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  autosaveEnabled: false,
  autosaveIntervalMs: 30_000,
  attachmentFolder: { mode: 'vault-folder', folderName: 'attachments' },
  activeContext: 'Default'
}

export default function App() {
  const rootPath = useVaultStore((s) => s.rootPath)
  const tree = useVaultStore((s) => s.tree)
  const setRootPath = useVaultStore((s) => s.setRootPath)
  const setTree = useVaultStore((s) => s.setTree)

  const variableValues = useVariablesStore((s) => s.values)
  const setUsage = useVariablesStore((s) => s.setUsage)
  const setValues = useVariablesStore((s) => s.setValues)
  const setContexts = useVariablesStore((s) => s.setContexts)
  const activeContext = useVariablesStore((s) => s.activeContext)
  const setActiveContext = useVariablesStore((s) => s.setActiveContext)
  const upsertContext = useVariablesStore((s) => s.upsertContext)

  // --- tabs ---
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const tabsRef = useRef<Tab[]>([])
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  // derived from active tab
  const activeTab = useMemo(() => tabs.find((t) => t.path === activeTabPath) ?? null, [tabs, activeTabPath])
  const activeFilePath = activeTab?.path ?? null
  const fileContent = activeTab?.content ?? ''
  const mode = activeTab?.mode ?? 'read'
  const isDirty = activeTab?.mode === 'edit' && activeTab?.draft !== activeTab?.content
  const anyDirty = useMemo(() => tabs.some((t) => t.mode === 'edit' && t.draft !== t.content), [tabs])

  const activeExtension = extensionOf(activeFilePath ?? '')
  const isCanvasFile = (activeFilePath ?? '').toLowerCase().endsWith('.canvas')
  const isImageFile = IMAGE_EXTENSIONS.has(activeExtension)
  const isPdfFile = activeExtension === 'pdf'
  const isMediaFile = isImageFile || isPdfFile

  // --- other state ---
  const [vaultSettings, setVaultSettings] = useState<VaultSettings>(DEFAULT_VAULT_SETTINGS)
  const [trashEntries, setTrashEntries] = useState<TrashManifest[]>([])
  const [overlay, setOverlay] = useState<'none' | 'help' | 'atlas' | 'settings'>('none')
  const [sidebarPanel, setSidebarPanel] = useState<'tree' | 'trash' | 'search'>('tree')
  const [exposureWarning, setExposureWarning] = useState<string | null>(null)
  const [promptState, setPromptState] = useState<{
    message: string
    defaultValue: string
    resolve: (value: string | null) => void
  } | null>(null)
  const [newFileDialogParent, setNewFileDialogParent] = useState<string | null>(null)
  const [folderFlagTarget, setFolderFlagTarget] = useState<{ path: string; name: string } | null>(null)
  const [findBarOpen, setFindBarOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    message: string
    confirmLabel: string
    danger: boolean
    resolve: (value: boolean) => void
  } | null>(null)

  function showPrompt(message: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) => setPromptState({ message, defaultValue, resolve }))
  }

  function showConfirm(message: string, options?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise((resolve) =>
      setConfirmState({ message, confirmLabel: options?.confirmLabel ?? 'OK', danger: options?.danger ?? false, resolve })
    )
  }

  const wikiLinkIndex = useMemo(() => buildWikiLinkIndex(tree), [tree])
  const embedIndex = useMemo(() => buildEmbedIndex(tree), [tree])

  function handleFlagsChange(newContent: string): void {
    if (!activeFilePath || !activeTab) return
    if (activeTab.mode === 'edit') {
      updateActiveTab({ draft: newContent })
    } else {
      api().file.write(activeFilePath, newContent)
      setTabs((prev) =>
        prev.map((t) => (t.path === activeFilePath ? { ...t, content: newContent, draft: newContent } : t))
      )
    }
  }

  function collectMdPaths(nodes: typeof tree, folderPath: string): string[] {
    const paths: string[] = []
    function visit(items: typeof tree): void {
      for (const n of items) {
        if (n.type === 'file' && n.name.toLowerCase().endsWith('.md') && n.path.startsWith(folderPath)) {
          paths.push(n.path)
        } else if (n.type === 'folder' && n.children) {
          visit(n.children)
        }
      }
    }
    visit(nodes)
    return paths
  }

  async function handleAssignFlagToFolder(flag: string): Promise<void> {
    if (!folderFlagTarget) return
    const paths = collectMdPaths(tree, folderFlagTarget.path)
    await Promise.all(
      paths.map(async (p) => {
        const content = await api().file.read(p)
        const existing = getFileTags(content)
        if (existing.includes(flag)) return
        const newContent = setFileTags(content, [...existing, flag])
        await api().file.write(p, newContent)
        setTabs((prev) =>
          prev.map((t) => (t.path === p ? { ...t, content: newContent, draft: newContent } : t))
        )
      })
    )
    setFolderFlagTarget(null)
  }

  // --- tab helpers ---
  function updateActiveTab(partial: Partial<Omit<Tab, 'path'>>): void {
    if (!activeTabPath) return
    setTabs((prev) => prev.map((t) => (t.path === activeTabPath ? { ...t, ...partial } : t)))
  }

  async function confirmDiscard(): Promise<boolean> {
    if (!isDirty) return true
    return showConfirm('You have unsaved changes. Discard them?', { confirmLabel: 'Discard', danger: true })
  }

  const openTab = useCallback(async (path: string) => {
    if (tabsRef.current.some((t) => t.path === path)) {
      setActiveTabPath(path)
      return
    }
    const ext = extensionOf(path)
    const isMedia = IMAGE_EXTENSIONS.has(ext) || ext === 'pdf'
    const content = isMedia ? '' : await api().file.read(path)
    setTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev
      return [...prev, { path, content, draft: content, mode: 'read' }]
    })
    setActiveTabPath(path)
  }, [])

  async function closeTab(path: string): Promise<void> {
    const currentTabs = tabsRef.current
    const tab = currentTabs.find((t) => t.path === path)
    if (!tab) return
    const tabDirty = tab.mode === 'edit' && tab.draft !== tab.content
    if (tabDirty && !(await showConfirm('Unsaved changes in this tab. Discard them?', { confirmLabel: 'Discard', danger: true }))) return
    const newTabs = currentTabs.filter((t) => t.path !== path)
    setTabs(newTabs)
    if (activeTabPath === path) {
      const idx = currentTabs.findIndex((t) => t.path === path)
      const next = newTabs[idx] ?? newTabs[idx - 1] ?? null
      setActiveTabPath(next?.path ?? null)
    }
  }

  // --- effects ---
  useEffect(() => {
    api().editor.setDirty(anyDirty)
  }, [anyDirty])

  useEffect(() => {
    return api().window.onConfirmClose(async () => {
      const ok = await showConfirm('You have unsaved changes. Leave without saving?', {
        confirmLabel: 'Leave without saving',
        danger: true
      })
      if (ok) api().window.confirmCloseAccepted()
    })
  }, [])

  useEffect(() => {
    function refreshWarning(): void {
      api()
        .exposure.getStatus()
        .then((s: ExposureStatus) => setExposureWarning(s.warning))
    }
    refreshWarning()
    const timer = setInterval(refreshWarning, 30_000)
    return () => clearInterval(timer)
  }, [overlay])

  useEffect(() => {
    setFindBarOpen(false)
  }, [activeTabPath, mode])

  useEffect(() => {
    if (!vaultSettings.autosaveEnabled) return
    const timer = setInterval(() => {
      const dirtyTabs = tabsRef.current.filter((t) => t.mode === 'edit' && t.draft !== t.content)
      if (dirtyTabs.length === 0) return
      for (const t of dirtyTabs) api().file.write(t.path, t.draft)
      setTabs((prev) =>
        prev.map((t) => (t.mode === 'edit' && t.draft !== t.content ? { ...t, content: t.draft } : t))
      )
    }, vaultSettings.autosaveIntervalMs)
    return () => clearInterval(timer)
  }, [vaultSettings.autosaveEnabled, vaultSettings.autosaveIntervalMs])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent): void {
      if (tabsRef.current.some((t) => t.mode === 'edit' && t.draft !== t.content)) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // --- vault loading ---
  async function loadVault(path: string): Promise<void> {
    setTabs([])
    setActiveTabPath(null)
    setRootPath(path)
    const newTree = await api().vault.getTree(path)
    setTree(newTree)
    const usage = await api().variables.scanUsage(path)
    setUsage(usage)
    const persisted = await api().variables.loadPersisted(path)
    const settings = await api().vaultSettings.read(path)
    setVaultSettings(settings)

    let contexts = persisted.contexts
    const activeName = settings.activeContext
    const existing = contexts.find((c) => c.name === activeName)
    const activeValues = existing?.values ?? persisted.values

    if (!existing) {
      const created = await api().variables.saveContext(path, activeName, persisted.values)
      contexts = [...contexts, created]
    }

    setContexts(contexts)
    setValues(activeValues)
    setActiveContext(activeName)
    await api().vault.setLastVaultPath(path)
  }

  useEffect(() => {
    api()
      .vault.getLastVaultPath()
      .then((path) => { if (path) loadVault(path) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- file operations ---
  async function refreshTree(): Promise<void> {
    if (!rootPath) return
    const [newTree, usage] = await Promise.all([api().vault.getTree(rootPath), api().variables.scanUsage(rootPath)])
    setTree(newTree)
    setUsage(usage)
  }

  async function refreshTrash(): Promise<void> {
    if (!rootPath) return
    setTrashEntries(await api().trash.list(rootPath))
  }

  function handleCreateFile(parentDirPath: string): void {
    setNewFileDialogParent(parentDirPath)
  }

  async function submitNewFile(name: string, template: string): Promise<void> {
    if (!newFileDialogParent) return
    const parentDirPath = newFileDialogParent
    setNewFileDialogParent(null)
    try {
      const content = await api().templates.getContent(template)
      const filePath = await api().vault.createFile(parentDirPath, name, content)
      await refreshTree()
      await openTab(filePath)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleCreateFolder(parentDirPath: string): Promise<void> {
    const name = await showPrompt('New folder name:')
    if (!name) return
    try {
      await api().vault.createFolder(parentDirPath, name)
      await refreshTree()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleRename(path: string, type: 'file' | 'folder', currentName: string): Promise<void> {
    const newName = await showPrompt('Rename to:', currentName)
    if (!newName || newName === currentName) return
    try {
      const newPath = await api().vault.rename(path, newName, type)
      await refreshTree()
      setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, path: newPath } : t)))
      if (activeTabPath === path) setActiveTabPath(newPath)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleDuplicate(path: string): Promise<void> {
    try {
      await api().vault.duplicate(path)
      await refreshTree()
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleDelete(path: string, type: 'file' | 'folder'): Promise<void> {
    if (!rootPath) return
    if (!(await showConfirm(`Delete this ${type}? It will be moved to Trash.`, { confirmLabel: 'Delete', danger: true }))) return
    await api().vault.softDelete(rootPath, path, type)
    const currentTabs = tabsRef.current
    const newTabs = currentTabs.filter((t) => t.path !== path)
    setTabs(newTabs)
    if (activeTabPath === path) {
      const idx = currentTabs.findIndex((t) => t.path === path)
      const next = newTabs[idx] ?? newTabs[idx - 1] ?? null
      setActiveTabPath(next?.path ?? null)
    }
    await refreshTree()
  }

  async function handleMove(sourcePath: string, destDirPath: string): Promise<void> {
    try {
      const newPath = await api().vault.move(sourcePath, destDirPath)
      await refreshTree()
      setTabs((prev) => prev.map((t) => (t.path === sourcePath ? { ...t, path: newPath } : t)))
      if (activeTabPath === sourcePath) setActiveTabPath(newPath)
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  async function handleRestoreFromTrash(id: string): Promise<void> {
    if (!rootPath) return
    await api().trash.restore(rootPath, id)
    await refreshTree()
    await refreshTrash()
  }

  async function handlePurgeFromTrash(id: string): Promise<void> {
    if (!rootPath) return
    if (!(await showConfirm('Permanently delete this item? This cannot be undone.', { confirmLabel: 'Delete permanently', danger: true }))) return
    await api().trash.purge(rootPath, id)
    await refreshTrash()
  }

  async function handleOpenTrash(): Promise<void> {
    setOverlay('none')
    await refreshTrash()
    setSidebarPanel('trash')
  }

  async function handlePickFolder(): Promise<void> {
    const hasDirty = tabsRef.current.some((t) => t.mode === 'edit' && t.draft !== t.content)
    if (hasDirty && !(await showConfirm('You have unsaved changes. Discard them?', { confirmLabel: 'Discard', danger: true }))) return
    const { path } = await api().vault.pickFolder()
    if (!path) return
    await loadVault(path)
  }

  function handleSelectFile(path: string): void {
    openTab(path)
  }

  const handleSave = useCallback(async (): Promise<void> => {
    const path = activeTabPath
    const tab = tabsRef.current.find((t) => t.path === path)
    if (!path || !tab || tab.mode !== 'edit') return
    await api().file.write(path, tab.draft)
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content: t.draft } : t)))
  }, [activeTabPath])

  const handleToggleCheckbox = useCallback(async (lineIndex: number): Promise<void> => {
    const path = activeTabPath
    const tab = tabsRef.current.find((t) => t.path === path)
    if (!path || !tab) return
    const toggled = toggleTaskListLine(tab.content, lineIndex)
    if (toggled === tab.content) return
    await api().file.write(path, toggled)
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content: toggled, draft: toggled } : t)))
  }, [activeTabPath])

  async function updateAutosaveSetting(partial: Partial<VaultSettings>): Promise<void> {
    if (!rootPath) return
    const next = { ...vaultSettings, ...partial }
    setVaultSettings(next)
    await api().vaultSettings.write(rootPath, next)
  }

  useEffect(() => {
    if (!rootPath) return
    const timer = setTimeout(() => {
      api().variables.persistValues(rootPath, variableValues)
      if (activeContext) {
        api()
          .variables.saveContext(rootPath, activeContext, variableValues)
          .then(upsertContext)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [rootPath, variableValues, activeContext, upsertContext])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }

      if (mod && e.key.toLowerCase() === 'f') {
        const activeEl = document.activeElement
        const inEditor = activeEl instanceof Element && !!activeEl.closest('.cm-editor')
        if (inEditor) return
        e.preventDefault()
        if (activeFilePath && mode !== 'edit') {
          setFindBarOpen(true)
        } else if (rootPath) {
          setOverlay('none')
          setSidebarPanel('search')
        }
        return
      }

      if (mod && e.key.toLowerCase() === 'n') {
        if (!rootPath) return
        e.preventDefault()
        handleCreateFile(rootPath)
        return
      }

      if (e.key === 'Escape') {
        if (promptState) {
          promptState.resolve(null)
          setPromptState(null)
        } else if (newFileDialogParent !== null) {
          setNewFileDialogParent(null)
        } else if (findBarOpen) {
          setFindBarOpen(false)
        } else if (overlay !== 'none') {
          setOverlay('none')
        } else if (sidebarPanel !== 'tree') {
          setSidebarPanel('tree')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, rootPath, promptState, newFileDialogParent, overlay, sidebarPanel, activeFilePath, mode, findBarOpen])

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="btn btn-primary" onClick={handlePickFolder}>Open vault folder</button>
        {rootPath && <span className="vault-path">{rootPath}</span>}
        <div className="button-group">
          {rootPath && (
            <button className="btn btn-secondary btn-icon" title="Trash" onClick={handleOpenTrash}>
              🗑︎
            </button>
          )}
          {rootPath && (
            <button
              className="btn btn-secondary btn-icon"
              title="Search"
              onClick={() => { setOverlay('none'); setSidebarPanel('search') }}
            >
              🔍︎
            </button>
          )}
          {rootPath && (
            <button
              className="btn btn-secondary btn-icon"
              title="Atlas"
              onClick={() => { setSidebarPanel('tree'); setOverlay('atlas') }}
            >
              🗺︎
            </button>
          )}
          <button
            className="btn btn-secondary btn-icon help-button"
            title="Help"
            onClick={() => { setSidebarPanel('tree'); setOverlay('help') }}
          >
            ?
          </button>
          <button
            className="btn btn-secondary btn-icon"
            title="Settings"
            onClick={() => { setSidebarPanel('tree'); setOverlay('settings') }}
          >
            ⚙︎
          </button>
        </div>
        {exposureWarning && <span className="exposure-banner">⚠ {exposureWarning}</span>}
        {activeFilePath && !isCanvasFile && !isMediaFile && (
          <div className="editor-controls">
            <button
              className="btn btn-secondary btn-icon"
              title={mode === 'edit' ? 'Preview' : 'Edit'}
              onClick={async () => {
                if (mode === 'edit' && !(await confirmDiscard())) return
                updateActiveTab({ mode: mode === 'edit' ? 'read' : 'edit' })
              }}
            >
              {mode === 'edit' ? '👁︎' : '✎'}
            </button>
            <button
              className="btn btn-secondary btn-icon"
              title={mode === 'commands' ? 'Preview' : 'Commands'}
              onClick={() => updateActiveTab({ mode: mode === 'commands' ? 'read' : 'commands' })}
            >
              {mode === 'commands' ? '👁︎' : '⌘'}
            </button>
            {mode === 'edit' && (
              <button className="btn btn-primary" onClick={handleSave} disabled={!isDirty}>
                Save{isDirty ? ' ●' : ''}
              </button>
            )}
          </div>
        )}
      </header>
      {overlay === 'settings' ? (
        <ExposurePanel
          currentVaultRoot={rootPath}
          vaultSettings={vaultSettings}
          onUpdateVaultSettings={updateAutosaveSetting}
          onClose={() => setOverlay('none')}
        />
      ) : overlay === 'help' ? (
        <HelpPage onClose={() => setOverlay('none')} />
      ) : overlay === 'atlas' && rootPath ? (
        <AtlasView
          tree={tree}
          rootPath={rootPath}
          onOpenFile={(path) => { setOverlay('none'); handleSelectFile(path) }}
          onCreateFile={(parentDirPath) => { setOverlay('none'); handleCreateFile(parentDirPath) }}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setOverlay('none')}
        />
      ) : (
        <div className="app-body">
          <aside className="app-sidebar">
            {!rootPath ? (
              <p className="empty-hint">Open a folder to start browsing your cheatsheets.</p>
            ) : sidebarPanel === 'trash' ? (
              <TrashPanel
                entries={trashEntries}
                onRestore={handleRestoreFromTrash}
                onPurge={handlePurgeFromTrash}
                onClose={() => setSidebarPanel('tree')}
              />
            ) : sidebarPanel === 'search' ? (
              <SearchPanel
                rootPath={rootPath}
                onOpenFile={(filePath) => { setSidebarPanel('tree'); handleSelectFile(filePath) }}
                onClose={() => setSidebarPanel('tree')}
              />
            ) : (
              <FileTree
                nodes={tree}
                activeFilePath={activeFilePath}
                rootPath={rootPath}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onMove={handleMove}
                onAssignFlagToFolder={(path, name) => setFolderFlagTarget({ path, name })}
              />
            )}
          </aside>
          <main className="app-main">
            {tabs.length > 0 && (
              <div className="tab-bar">
                {tabs.map((tab) => {
                  const tabDirty = tab.mode === 'edit' && tab.draft !== tab.content
                  const label = tab.path.split(/[\\/]/).pop() ?? tab.path
                  return (
                    <div
                      key={tab.path}
                      className={`tab${tab.path === activeTabPath ? ' tab-active' : ''}`}
                      onClick={() => setActiveTabPath(tab.path)}
                      title={tab.path}
                    >
                      <span className="tab-label">{label}</span>
                      {tabDirty && <span className="tab-dirty-dot">●</span>}
                      <button
                        className="tab-close-btn"
                        onClick={async (e) => { e.stopPropagation(); await closeTab(tab.path) }}
                        title="Close tab"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="app-main-content">
            {findBarOpen && <FindBar onClose={() => setFindBarOpen(false)} />}
            {activeTab ? (
              isImageFile ? (
                <div key={activeFilePath} className="file-viewer">
                  <img className="file-viewer-image" src={vaultAssetUrl(activeFilePath!)} alt={activeFilePath!} />
                </div>
              ) : isPdfFile ? (
                <iframe key={activeFilePath} className="file-viewer-pdf" src={vaultAssetUrl(activeFilePath!)} title={activeFilePath!} />
              ) : isCanvasFile ? (
                <CanvasView
                  key={activeFilePath}
                  content={fileContent}
                  filePath={activeFilePath!}
                  vaultRoot={rootPath ?? ''}
                  wikiLinkIndex={wikiLinkIndex}
                  embedIndex={embedIndex}
                  variableValues={variableValues}
                  onOpenFile={handleSelectFile}
                  onSave={(json) => {
                    api().file.write(activeFilePath!, json)
                    setTabs((prev) => prev.map((t) => (t.path === activeFilePath ? { ...t, content: json, draft: json } : t)))
                  }}
                />
              ) : mode === 'edit' ? (
                <MarkdownEditor
                  key={activeFilePath}
                  value={fileContent}
                  filePath={activeFilePath!}
                  vaultRoot={rootPath ?? ''}
                  attachmentFolder={vaultSettings.attachmentFolder}
                  wikiLinkIndex={wikiLinkIndex}
                  embedIndex={embedIndex}
                  onNavigate={handleSelectFile}
                  onChange={(value) => updateActiveTab({ draft: value })}
                />
              ) : mode === 'commands' ? (
                <CommandsView content={fileContent} variableValues={variableValues} />
              ) : (
                <MarkdownPreview
                  content={fileContent}
                  filePath={activeFilePath!}
                  vaultRoot={rootPath ?? ''}
                  wikiLinkIndex={wikiLinkIndex}
                  embedIndex={embedIndex}
                  variableValues={variableValues}
                  onNavigate={handleSelectFile}
                  onToggleCheckbox={handleToggleCheckbox}
                />
              )
            ) : (
              <p className="empty-hint">Select a cheatsheet to view it.</p>
            )}
            {activeTab && !isCanvasFile && !isMediaFile && (
              <FlagsBar
                content={activeTab.mode === 'edit' ? activeTab.draft : activeTab.content}
                onChange={handleFlagsChange}
              />
            )}
            </div>
          </main>
          <aside className="app-variables-panel">
            <h2 className="panel-title">Variables</h2>
            <VariablesPanel />
          </aside>
        </div>
      )}

      {newFileDialogParent !== null && (
        <NewFileDialog onSubmit={submitNewFile} onCancel={() => setNewFileDialogParent(null)} />
      )}

      {folderFlagTarget && (
        <FolderFlagDialog
          folderName={folderFlagTarget.name}
          fileCount={collectMdPaths(tree, folderFlagTarget.path).length}
          suggestedTags={[]}
          onAssign={handleAssignFlagToFolder}
          onCancel={() => setFolderFlagTarget(null)}
        />
      )}

      {promptState && (
        <PromptDialog
          message={promptState.message}
          defaultValue={promptState.defaultValue}
          onSubmit={(value) => { promptState.resolve(value); setPromptState(null) }}
          onCancel={() => { promptState.resolve(null); setPromptState(null) }}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={() => { confirmState.resolve(true); setConfirmState(null) }}
          onCancel={() => { confirmState.resolve(false); setConfirmState(null) }}
        />
      )}
    </div>
  )
}
