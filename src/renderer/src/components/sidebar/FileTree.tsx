import { useEffect, useRef, useState } from 'react'
import type { VaultTreeNode } from '../../../../../electron/main/shared-types'
import { dirnameOf } from '../../lib/paths'

interface MenuState {
  x: number
  y: number
  items: { label: string; onClick: () => void }[]
}

export interface FileTreeActions {
  onSelectFile: (path: string) => void
  onCreateFile: (parentDirPath: string) => void
  onCreateFolder: (parentDirPath: string) => void
  onRename: (path: string, type: 'file' | 'folder', currentName: string) => void
  onDuplicate: (path: string) => void
  onDelete: (path: string, type: 'file' | 'folder') => void
  onMove: (sourcePath: string, destDirPath: string) => void
  onAssignFlagToFolder: (folderPath: string, folderName: string) => void
}

interface FileTreeProps extends FileTreeActions {
  nodes: VaultTreeNode[]
  activeFilePath: string | null
  rootPath: string
}

function findAncestorPaths(nodes: VaultTreeNode[], targetPath: string, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.path === targetPath) return ancestors
    if (node.type === 'folder' && node.children) {
      const found = findAncestorPaths(node.children, targetPath, [...ancestors, node.path])
      if (found) return found
    }
  }
  return null
}

function getVisibleItems(nodes: VaultTreeNode[], expanded: Set<string>): VaultTreeNode[] {
  const result: VaultTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.type === 'folder' && expanded.has(node.path) && node.children) {
      result.push(...getVisibleItems(node.children, expanded))
    }
  }
  return result
}

function findParentPath(nodes: VaultTreeNode[], targetPath: string, parentPath: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return parentPath
    if (node.type === 'folder' && node.children) {
      const found = findParentPath(node.children, targetPath, node.path)
      if (found !== undefined) return found
    }
  }
  return undefined
}

export default function FileTree({ nodes, activeFilePath, rootPath, ...actions }: FileTreeProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [rootDragOver, setRootDragOver] = useState(false)
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  function toggleExpanded(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Auto-expand ancestors when the active file changes
  useEffect(() => {
    if (!activeFilePath) return
    const ancestors = findAncestorPaths(nodes, activeFilePath)
    if (ancestors && ancestors.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev)
        ancestors.forEach((p) => next.add(p))
        return next
      })
    }
  }, [activeFilePath, nodes])

  function openMenu(e: React.MouseEvent, items: MenuState['items']): void {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function rootMenuItems(): MenuState['items'] {
    return [
      { label: 'New cheatsheet', onClick: () => actions.onCreateFile(rootPath) },
      { label: 'New folder', onClick: () => actions.onCreateFolder(rootPath) }
    ]
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    const visible = getVisibleItems(nodes, expanded)
    if (visible.length === 0) return

    const currentPath = focusedPath ?? activeFilePath
    const currentIdx = currentPath ? visible.findIndex((v) => v.path === currentPath) : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = visible[currentIdx + 1]
      if (next) setFocusedPath(next.path)
      else if (currentIdx === -1 && visible.length > 0) setFocusedPath(visible[0].path)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentIdx > 0) setFocusedPath(visible[currentIdx - 1].path)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const current = visible[currentIdx]
      if (!current) return
      if (current.type === 'folder') {
        if (!expanded.has(current.path)) toggleExpanded(current.path)
        else {
          const firstChild = visible[currentIdx + 1]
          if (firstChild) setFocusedPath(firstChild.path)
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const current = visible[currentIdx]
      if (!current) return
      if (current.type === 'folder' && expanded.has(current.path)) {
        toggleExpanded(current.path)
      } else {
        const parent = findParentPath(nodes, current.path)
        if (parent) setFocusedPath(parent)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = visible[currentIdx]
      if (!current) return
      if (current.type === 'file') actions.onSelectFile(current.path)
      else toggleExpanded(current.path)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`file-tree-root${rootDragOver ? ' drag-over' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={() => setFocusedPath(null)}
      onContextMenu={(e) => openMenu(e, rootMenuItems())}
      onDragEnter={(e) => { e.preventDefault(); setRootDragOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootDragOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setRootDragOver(false)
        const sourcePath = e.dataTransfer.getData('text/plain')
        if (sourcePath) actions.onMove(sourcePath, rootPath)
      }}
    >
      <ul className="file-tree">
        {nodes.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            activeFilePath={activeFilePath}
            focusedPath={focusedPath}
            openMenu={openMenu}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onSetFocused={setFocusedPath}
            {...actions}
          />
        ))}
      </ul>
      {nodes.length === 0 && <p className="empty-hint">Right-click to create a cheatsheet or folder.</p>}

      {menu && (
        <>
          <div className="context-menu-backdrop" onClick={() => setMenu(null)} onContextMenu={(e) => e.preventDefault()} />
          <div className="context-menu" style={{ top: menu.y, left: menu.x }}>
            {menu.items.map((item) => (
              <button
                key={item.label}
                className="context-menu-item"
                onClick={() => { item.onClick(); setMenu(null) }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface FileTreeNodeProps extends FileTreeActions {
  node: VaultTreeNode
  activeFilePath: string | null
  focusedPath: string | null
  openMenu: (e: React.MouseEvent, items: MenuState['items']) => void
  expanded: Set<string>
  onToggleExpanded: (path: string) => void
  onSetFocused: (path: string) => void
}

function displayName(node: VaultTreeNode): string {
  return node.type === 'file' && node.name.toLowerCase().endsWith('.md') ? node.name.slice(0, -3) : node.name
}

function FileTreeNode({ node, activeFilePath, focusedPath, openMenu, expanded, onToggleExpanded, onSetFocused, ...actions }: FileTreeNodeProps) {
  const [dragOver, setDragOver] = useState(false)

  if (node.type === 'folder') {
    const menuItems: MenuState['items'] = [
      { label: 'New cheatsheet', onClick: () => actions.onCreateFile(node.path) },
      { label: 'New folder', onClick: () => actions.onCreateFolder(node.path) },
      { label: 'Rename', onClick: () => actions.onRename(node.path, 'folder', node.name) },
      { label: 'Assigner un flag', onClick: () => actions.onAssignFlagToFolder(node.path, node.name) },
      { label: 'Delete folder', onClick: () => actions.onDelete(node.path, 'folder') }
    ]

    const isCollapsed = !expanded.has(node.path)
    const hasChildren = !!node.children && node.children.length > 0
    const isFocused = focusedPath === node.path

    return (
      <li className="file-tree-folder">
        <span
          className={`file-tree-folder-label${dragOver ? ' drag-over' : ''}${isFocused ? ' keyboard-focused' : ''}`}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', node.path); e.stopPropagation() }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOver(false)
            const sourcePath = e.dataTransfer.getData('text/plain')
            if (sourcePath && sourcePath !== node.path && !node.path.startsWith(sourcePath + '/') && !node.path.startsWith(sourcePath + '\\')) {
              actions.onMove(sourcePath, node.path)
            }
          }}
          onClick={() => { onSetFocused(node.path); hasChildren && onToggleExpanded(node.path) }}
          onContextMenu={(e) => openMenu(e, menuItems)}
        >
          <span className={`file-tree-chevron${hasChildren ? '' : ' file-tree-chevron-empty'}${isCollapsed ? ' collapsed' : ''}`}>
            {hasChildren ? '▾' : ''}
          </span>
          {node.name}
        </span>
        {hasChildren && !isCollapsed && (
          <ul className="file-tree">
            {node.children!.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                activeFilePath={activeFilePath}
                focusedPath={focusedPath}
                openMenu={openMenu}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                onSetFocused={onSetFocused}
                {...actions}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isActive = node.path === activeFilePath
  const isFocused = focusedPath === node.path
  const parentDir = dirnameOf(node.path)
  const menuItems: MenuState['items'] = [
    { label: 'Rename', onClick: () => actions.onRename(node.path, 'file', node.name) },
    { label: 'Duplicate', onClick: () => actions.onDuplicate(node.path) },
    { label: 'Delete', onClick: () => actions.onDelete(node.path, 'file') }
  ]

  return (
    <li
      className={`file-tree-file${isActive ? ' active' : ''}${dragOver ? ' drag-over' : ''}${isFocused ? ' keyboard-focused' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', node.path)}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const sourcePath = e.dataTransfer.getData('text/plain')
        if (sourcePath && sourcePath !== node.path && dirnameOf(sourcePath) !== parentDir) {
          actions.onMove(sourcePath, parentDir)
        }
      }}
      onClick={() => { onSetFocused(node.path); actions.onSelectFile(node.path) }}
      onContextMenu={(e) => openMenu(e, menuItems)}
    >
      {displayName(node)}
    </li>
  )
}
