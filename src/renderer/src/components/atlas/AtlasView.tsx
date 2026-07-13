import { useEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { VaultTreeNode } from '../../../../../electron/main/shared-types'
import { api } from '../../lib/ipc'
import { collectFilePaths, computeMetric, colorForConcept, filterAtlasTree, type FileMetric } from '../../lib/atlas'
import { getFileTags, setFileTags } from '../../lib/frontmatter'
import FlagPickerDialog from '../common/FlagPickerDialog'
import FolderFlagDialog from '../common/FolderFlagDialog'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 760
const COMPACT_TAG_LIMIT = 10

interface AtlasNode extends VaultTreeNode {
  name: string
}

interface AtlasViewProps {
  tree: VaultTreeNode[]
  rootPath: string
  onOpenFile: (path: string) => void
  onCreateFile: (parentDirPath: string) => void
  onRename: (path: string, type: 'file' | 'folder', currentName: string) => void
  onDuplicate: (path: string) => void
  onDelete: (path: string, type: 'file' | 'folder') => void
  onClose: () => void
}

interface MenuState {
  x: number
  y: number
  items: { label: string; onClick: () => void }[]
}

export default function AtlasView({
  tree,
  rootPath,
  onOpenFile,
  onCreateFile,
  onRename,
  onDuplicate,
  onDelete,
  onClose
}: AtlasViewProps) {
  const [metrics, setMetrics] = useState<Record<string, FileMetric>>({})
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [flagPickerPath, setFlagPickerPath] = useState<string | null>(null)
  const [folderFlagTarget, setFolderFlagTarget] = useState<{ path: string; name: string } | null>(null)
  const [showAllTags, setShowAllTags] = useState(false)
  const [focusedGroupPath, setFocusedGroupPath] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const searchRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = canvasRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(640, Math.round(entry.contentRect.width))
      const height = Math.max(420, Math.round(entry.contentRect.height))
      setCanvasSize((current) => current.width === width && current.height === height ? current : { width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      const paths = collectFilePaths(filterAtlasTree(tree))
      const entries = await Promise.all(
        paths.map(async (p) => {
          const content = await api().file.read(p)
          return computeMetric(p, content, rootPath)
        })
      )
      if (cancelled) return
      const map: Record<string, FileMetric> = {}
      for (const m of entries) map[m.path] = m
      setMetrics(map)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tree, rootPath])

  const cheatsheetTree = useMemo(() => filterAtlasTree(tree), [tree])

  // All unique tags sorted by frequency descending
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of Object.values(metrics)) {
      const labels = m.tags.length > 0 ? m.tags : [m.concept]
      for (const t of labels) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [metrics])

  const searchLower = search.toLowerCase().trim()
  const hasFilter = selectedTags.size > 0 || searchLower.length > 0
  const showOverview = !focusedGroupPath && !hasFilter

  const focusedGroup = useMemo(
    () => cheatsheetTree.find((node) => node.path === focusedGroupPath) ?? null,
    [cheatsheetTree, focusedGroupPath]
  )

  const baseTree = useMemo(() => {
    if (!focusedGroup) return cheatsheetTree
    return focusedGroup.type === 'folder' ? focusedGroup.children ?? [] : [focusedGroup]
  }, [cheatsheetTree, focusedGroup])

  const overviewGroups = useMemo(() => cheatsheetTree.map((node) => ({
    node,
    count: collectFilePaths([node]).length,
    sampleNames: collectFilePaths([node]).slice(0, 3).map((path) =>
      path.replace(/\\/g, '/').split('/').pop()?.replace(/\.md$/i, '') ?? ''
    )
  })).filter((item) => item.count > 0), [cheatsheetTree])

  // Paths that pass both the tag filter and the text search
  const visiblePaths = useMemo(() => {
    const set = new Set<string>()
    for (const m of Object.values(metrics)) {
      if (focusedGroupPath && !m.path.startsWith(focusedGroupPath)) continue
      if (selectedTags.size > 0) {
        const labels = m.tags.length > 0 ? m.tags : [m.concept]
        const hasAll = [...selectedTags].every((t) => labels.includes(t))
        if (!hasAll) continue
      }
      if (searchLower) {
        const searchable = `${relPath(m.path)} ${m.tags.join(' ')}`.toLowerCase()
        if (!searchable.includes(searchLower)) continue
      }
      set.add(m.path)
    }
    return set
  }, [metrics, selectedTags, searchLower, focusedGroupPath])

  const displayedTree = useMemo(() => {
    if (!hasFilter) return baseTree
    function prune(nodes: VaultTreeNode[]): VaultTreeNode[] {
      return nodes.flatMap((node) => {
        if (node.type === 'file') return visiblePaths.has(node.path) ? [node] : []
        const children = prune(node.children ?? [])
        return children.length > 0 ? [{ ...node, children }] : []
      })
    }
    return prune(baseTree)
  }, [baseTree, hasFilter, visiblePaths])

  const { leaves, groups } = useMemo(() => {
    const root = hierarchy<AtlasNode>(
      { name: 'root', path: rootPath, type: 'folder', children: displayedTree } as AtlasNode,
      (d) => d.children as AtlasNode[] | undefined
    )
      .sum((d) => (d.type === 'file' ? 18 + Math.sqrt(metrics[d.path]?.lineCount ?? 1) : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const laidOut = treemap<AtlasNode>()
      .size([canvasSize.width, canvasSize.height])
      .paddingInner(3)
      .paddingOuter(6)
      .paddingTop(24)
      .round(true)(root) as HierarchyRectangularNode<AtlasNode>

    return {
      leaves: laidOut.leaves(),
      groups: laidOut.descendants().filter((d) => d.depth === 1 && d.children && d.children.length > 0)
    }
  }, [displayedTree, rootPath, metrics, canvasSize])

  function toggleTag(tag: string): void {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function clearFilters(): void {
    setSelectedTags(new Set())
    setSearch('')
    searchRef.current?.focus()
  }

  async function assignFlagToGroup(flag: string): Promise<void> {
    if (!folderFlagTarget) return
    const groupLeaves = leaves.filter((l) =>
      l.data.path.startsWith(folderFlagTarget.path) && l.data.name.toLowerCase().endsWith('.md')
    )
    await Promise.all(
      groupLeaves.map(async (leaf) => {
        const p = leaf.data.path
        const content = await api().file.read(p)
        const existing = getFileTags(content)
        if (existing.includes(flag)) return
        const updated = setFileTags(content, [...existing, flag])
        await api().file.write(p, updated)
        setMetrics((prev) => ({
          ...prev,
          [p]: { ...prev[p], tags: [...existing, flag] }
        }))
      })
    )
    setFolderFlagTarget(null)
  }

  async function saveFlagsForPath(path: string, newTags: string[]): Promise<void> {
    const content = await api().file.read(path)
    const updated = setFileTags(content, newTags)
    await api().file.write(path, updated)
    setMetrics((prev) => ({
      ...prev,
      [path]: { ...prev[path], tags: newTags }
    }))
    setFlagPickerPath(null)
  }

  function openTileMenu(e: React.MouseEvent, node: AtlasNode): void {
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Open', onClick: () => onOpenFile(node.path) },
        { label: 'Gérer les flags', onClick: () => { setMenu(null); setFlagPickerPath(node.path) } },
        { label: 'Rename', onClick: () => onRename(node.path, 'file', node.name) },
        { label: 'Duplicate', onClick: () => onDuplicate(node.path) },
        { label: 'Delete', onClick: () => onDelete(node.path, 'file') }
      ]
    })
  }

  const hoveredMetric = hoveredPath ? metrics[hoveredPath] : null
  const visibleCount = showOverview
    ? overviewGroups.reduce((total, group) => total + group.count, 0)
    : visiblePaths.size
  const shownTags = showAllTags ? tagCounts : tagCounts.slice(0, COMPACT_TAG_LIMIT)

  function relPath(p: string): string {
    const norm = p.replace(/\\/g, '/')
    const normRoot = rootPath.replace(/\\/g, '/')
    return norm.startsWith(normRoot) ? norm.slice(normRoot.length).replace(/^\//, '') : p
  }

  return (
    <div className="atlas-view">
      <div className="atlas-header">
        <div className="atlas-heading">
          <div className="atlas-breadcrumb">
            {focusedGroup ? (
              <>
                <button onClick={() => setFocusedGroupPath(null)}>Atlas</button>
                <span>/</span>
                <h2>{focusedGroup.name}</h2>
              </>
            ) : <h2>Atlas</h2>}
          </div>
          <span>{visibleCount} cheatsheet{visibleCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="atlas-filter-bar">
          <div className="atlas-search-wrap">
            <input
              ref={searchRef}
              className="atlas-search-input"
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') clearFilters() }}
            />
          </div>

          <div className="atlas-tags">
            {shownTags.map(([tag, count]) => (
              <button
                key={tag}
                className={`concept-chip${selectedTags.has(tag) ? ' active' : ''}`}
                style={{ borderColor: colorForConcept(tag) }}
                onClick={() => toggleTag(tag)}
                title={`${count} note${count > 1 ? 's' : ''}`}
              >
                {tag}
                <span className="concept-chip-count">{count}</span>
              </button>
            ))}
            {tagCounts.length > COMPACT_TAG_LIMIT && (
              <button className="atlas-more-tags" onClick={() => setShowAllTags((value) => !value)}>
                {showAllTags ? 'Réduire' : `+${tagCounts.length - COMPACT_TAG_LIMIT} filtres`}
              </button>
            )}
          </div>

          {hasFilter && (
            <div className="atlas-filter-status">
              <span className="atlas-filter-count">{visibleCount} note{visibleCount !== 1 ? 's' : ''}</span>
              <button className="atlas-clear-btn" onClick={clearFilters} title="Effacer les filtres">✕</button>
            </div>
          )}
        </div>

        <button className="btn btn-secondary btn-compact" onClick={onClose}>Fermer</button>
      </div>
      <div className="atlas-canvas" ref={canvasRef}>
        {showOverview ? (
          <div className="atlas-overview">
            {overviewGroups.map(({ node, count, sampleNames }) => (
              <button
                key={node.path}
                className="atlas-domain-card"
                style={{ '--domain-color': colorForConcept(node.name) } as React.CSSProperties}
                onClick={() => node.type === 'file' ? onOpenFile(node.path) : setFocusedGroupPath(node.path)}
              >
                <span className="atlas-domain-marker" />
                <span className="atlas-domain-name">{node.name}</span>
                <span className="atlas-domain-count">{count} note{count !== 1 ? 's' : ''}</span>
                <span className="atlas-domain-samples">{sampleNames.join(' · ')}</span>
                <span className="atlas-domain-action">Explorer →</span>
              </button>
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <div className="atlas-empty">
            <strong>Aucune cheatsheet trouvée</strong>
            <span>Essayez une recherche plus large ou effacez les filtres.</span>
          </div>
        ) : (
        <svg
          className="atlas-svg"
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          preserveAspectRatio="none"
        >
        <rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} className="atlas-background" />

        {groups.map((group) => {
          const node = group.data
          const w = (group.x1 ?? 0) - (group.x0 ?? 0)
          const h = (group.y1 ?? 0) - (group.y0 ?? 0)
          return (
            <g
              key={node.path}
              transform={`translate(${group.x0},${group.y0})`}
              className="atlas-group"
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFolderFlagTarget({ path: node.path, name: node.name })
              }}
            >
              <rect
                width={Math.max(w, 0)}
                height={Math.max(h, 0)}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
                rx={5}
              />
              {w > 50 && (
                <text x={6} y={14} className="atlas-group-label">
                  {node.name}
                </text>
              )}
            </g>
          )
        })}

        {leaves.map((leaf) => {
          const node = leaf.data
          const metric = metrics[node.path]
          const concept = metric?.concept ?? 'general'
          const dimmed = !visiblePaths.has(node.path)
          const w = (leaf.x1 ?? 0) - (leaf.x0 ?? 0)
          const h = (leaf.y1 ?? 0) - (leaf.y0 ?? 0)
          const cleanName = node.name.replace(/\.md$/i, '')
          const maxChars = Math.max(3, Math.floor((w - 10) / 7))
          const tileName = cleanName.length > maxChars ? `${cleanName.slice(0, maxChars - 1)}…` : cleanName
          return (
            <g
              key={node.path}
              transform={`translate(${leaf.x0},${leaf.y0})`}
              opacity={dimmed ? 0 : 1}
              onClick={(e) => {
                e.stopPropagation()
                if (!dimmed) onOpenFile(node.path)
              }}
              onContextMenu={(e) => openTileMenu(e, node)}
              onMouseEnter={() => setHoveredPath(node.path)}
              onMouseLeave={() => setHoveredPath(null)}
              className="atlas-tile"
              style={{ cursor: dimmed ? 'default' : 'pointer' }}
            >
              <title>
                {node.name} ({metric?.lineCount ?? 0} lines){metric?.tags.length ? '\n' + metric.tags.join(', ') : ''}
              </title>
              <rect width={Math.max(w, 0)} height={Math.max(h, 0)} fill={colorForConcept(concept)} rx={3} />
              {w > 40 && h > 20 && (
                <text x={5} y={15} className="atlas-tile-label">
                  {tileName}
                </text>
              )}
              {w > 30 && h > 18 && metric?.tags.length > 0 && metric.tags.slice(0, Math.floor((w - 8) / 10)).map((tag, i) => (
                <rect
                  key={tag}
                  x={5 + i * 10}
                  y={Math.max(h - 6, 4)}
                  width={7}
                  height={3}
                  fill={colorForConcept(tag)}
                  rx={1.5}
                  opacity={0.9}
                />
              ))}
            </g>
          )
        })}
        </svg>
        )}
      </div>

      {hoveredMetric && (
        <div className="atlas-hover-hint">
          <span className="atlas-hover-name">{relPath(hoveredMetric.path)}</span>
          <span className="atlas-hover-meta">
            {hoveredMetric.lineCount} lines
            {hoveredMetric.tags.length > 0 && (
              <> · {hoveredMetric.tags.join(', ')}</>
            )}
          </span>
        </div>
      )}

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

      {folderFlagTarget && (() => {
        const groupLeaves = leaves.filter((l) =>
          l.data.path.startsWith(folderFlagTarget.path) && l.data.name.toLowerCase().endsWith('.md')
        )
        const allTags = tagCounts.map(([t]) => t)
        return (
          <FolderFlagDialog
            folderName={folderFlagTarget.name}
            fileCount={groupLeaves.length}
            suggestedTags={allTags}
            onAssign={assignFlagToGroup}
            onCancel={() => setFolderFlagTarget(null)}
          />
        )
      })()}

      {flagPickerPath && (() => {
        const m = metrics[flagPickerPath]
        const fileName = flagPickerPath.replace(/\\/g, '/').split('/').pop() ?? flagPickerPath
        const allTags = tagCounts.map(([t]) => t)
        const currentTags = m?.tags ?? getFileTags('')
        return (
          <FlagPickerDialog
            fileName={fileName}
            currentTags={currentTags}
            suggestedTags={allTags}
            onSave={(newTags) => saveFlagsForPath(flagPickerPath, newTags)}
            onCancel={() => setFlagPickerPath(null)}
          />
        )
      })()}
    </div>
  )
}
