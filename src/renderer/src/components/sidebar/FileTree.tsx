import { useState } from 'react'
import type { VaultTreeNode } from '../../../../../electron/main/shared-types'

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

export default function FileTree({ nodes, activeFilePath, rootPath, ...actions }: FileTreeProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  // Folders are collapsed by default — only paths the user has explicitly
  // expanded are tracked, so newly loaded/created folders start collapsed
  // with no need to re-initialize this set whenever the vault changes.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

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

  return (
    <div
      className="file-tree-root"
      onContextMenu={(e) => openMenu(e, rootMenuItems())}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
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
            openMenu={openMenu}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
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
                onClick={() => {
                  item.onClick()
                  setMenu(null)
                }}
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
  openMenu: (e: React.MouseEvent, items: MenuState['items']) => void
  expanded: Set<string>
  onToggleExpanded: (path: string) => void
}

function displayName(node: VaultTreeNode): string {
  return node.type === 'file' && node.name.toLowerCase().endsWith('.md') ? node.name.slice(0, -3) : node.name
}

function FileTreeNode({ node, activeFilePath, openMenu, expanded, onToggleExpanded, ...actions }: FileTreeNodeProps) {
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

    return (
      <li className="file-tree-folder">
        <span
          className="file-tree-folder-label"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', node.path)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const sourcePath = e.dataTransfer.getData('text/plain')
            if (sourcePath) actions.onMove(sourcePath, node.path)
          }}
          onClick={() => hasChildren && onToggleExpanded(node.path)}
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
                openMenu={openMenu}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                {...actions}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isActive = node.path === activeFilePath
  const menuItems: MenuState['items'] = [
    { label: 'Rename', onClick: () => actions.onRename(node.path, 'file', node.name) },
    { label: 'Duplicate', onClick: () => actions.onDuplicate(node.path) },
    { label: 'Delete', onClick: () => actions.onDelete(node.path, 'file') }
  ]

  return (
    <li
      className={`file-tree-file${isActive ? ' active' : ''}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', node.path)}
      onClick={() => actions.onSelectFile(node.path)}
      onContextMenu={(e) => openMenu(e, menuItems)}
    >
      {displayName(node)}
    </li>
  )
}
