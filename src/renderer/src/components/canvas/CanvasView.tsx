import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useVaultStore } from '../../state/vaultStore'
import NotePickerDialog from '../common/NotePickerDialog'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  NodeResizer,
  MarkerType,
  ConnectionMode,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
  type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { resolveRelative } from '../../lib/paths'
import { renderMarkdown } from '../../lib/markdownRenderer'
import { toggleTaskListLine } from '../../lib/taskList'
import type { FilePathIndex } from '../../lib/wikiLinks'
import { CanvasRenderContext, type CanvasRenderContextValue } from './canvasRenderContext'
import CanvasFilePreview from './CanvasFilePreview'

// React uses event delegation — synthetic onPointerDown fires at the React root,
// AFTER React Flow's native listener on .react-flow__node has already called
// preventDefault(). We need a native listener on the text element itself so it
// fires first in bubble order and stops propagation before RF sees the event.
function CanvasTextContent({ children }: { children: React.ReactNode }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e: Event): void => { e.stopPropagation() }
    el.addEventListener('pointerdown', stop)
    el.addEventListener('mousedown', stop)
    return () => {
      el.removeEventListener('pointerdown', stop)
      el.removeEventListener('mousedown', stop)
    }
  }, [])
  return (
    <div ref={ref} className="canvas-node-text markdown-preview nodrag nopan">
      {children}
    </div>
  )
}

// JSON Canvas 1.0 (jsoncanvas.org) — fields beyond what we actively render
// (subpath, label/background/backgroundStyle on groups, edge fromEnd/toEnd/
// color/label) are preserved through load->save via the raw-merge in the
// save effect below, even though this app doesn't have UI for them yet.
interface RawCanvasNode {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  x: number
  y: number
  width: number
  height: number
  color?: string
  text?: string
  file?: string
  subpath?: string
  url?: string
  label?: string
  background?: string
  backgroundStyle?: 'cover' | 'ratio' | 'repeat'
}

interface RawCanvasEdge {
  id: string
  fromNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toNode: string
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  fromEnd?: 'none' | 'arrow'
  toEnd?: 'none' | 'arrow'
  color?: string
  label?: string
}

interface CanvasData {
  nodes: RawCanvasNode[]
  edges: RawCanvasEdge[]
}

interface CanvasViewProps {
  content: string
  filePath: string
  vaultRoot: string
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  variableValues: Record<string, string>
  onOpenFile: (path: string) => void
  onSave: (json: string) => void
}

type NodeData = {
  text?: string
  file?: string
  url?: string
  label?: string
  color?: string
  fileLabel?: string
  resolvedPath?: string
  onOpenFile?: () => void
  onCommitText?: (text: string) => void
  onCommitLabel?: (label: string) => void
}

// JSON Canvas lets `color` be a hex string OR Obsidian's numbered preset
// (1-6, picked from its card color swatch — red/orange/yellow/green/cyan/
// purple). The spec leaves the exact hex up to each implementation. Resolve
// only at render time — never store the resolved hex back into node/edge
// data, so saving never overwrites the user's original "2" with a literal
// color and silently drops the "this is preset 2" intent.
const CANVAS_COLOR_PRESETS: Record<string, string> = {
  '1': '#e06c6c',
  '2': '#e0a93f',
  '3': '#e0d23f',
  '4': '#6cc644',
  '5': '#3fc6e0',
  '6': '#a23fe0'
}

function resolveCanvasColor(color?: string): string | undefined {
  if (!color) return undefined
  return CANVAS_COLOR_PRESETS[color] ?? color
}

const SIDE_HANDLES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

// One handle per side, not a stacked source+target pair at the same spot —
// stacking both at an identical position made connection drag-and-drop
// hit-test ambiguous (whichever was on top intercepted the pointer). A
// single "source" handle per side, combined with connectionMode="loose" on
// <ReactFlow>, lets every side both start and receive connections.
function SideHandles(): React.ReactElement {
  return (
    <>
      {SIDE_HANDLES.map((pos) => (
        <Handle key={pos} id={pos} type="source" position={pos} className="canvas-handle" />
      ))}
    </>
  )
}

function TextNode({ data, selected }: NodeProps & { data: NodeData }): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const ctx = useContext(CanvasRenderContext)
  const locked = ctx?.locked ?? true

  const rendered = useMemo(() => {
    if (!ctx || !data.text) return null
    const text = data.text
    const commit = data.onCommitText
    try {
      return renderMarkdown({
        content: text,
        filePath: ctx.filePath,
        vaultRoot: ctx.vaultRoot,
        wikiLinkIndex: ctx.wikiLinkIndex,
        embedIndex: ctx.embedIndex,
        variableValues: ctx.variableValues,
        onNavigate: ctx.onNavigate,
        collectCodeBlocks: false,
        onToggleCheckbox: (lineIndex) => {
          commit?.(toggleTaskListLine(text, lineIndex))
        }
      }).element
    } catch {
      return null
    }
    // ctx already includes variableValues, wikiLinkIndex, etc. — all deps are captured through ctx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, data.text])

  return (
    <div
      className={`canvas-node canvas-node-text-shell${locked ? ' nopan' : ''}`}
      style={{ '--node-accent': resolveCanvasColor(data.color) } as React.CSSProperties}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
    >
      <NodeResizer isVisible={selected && !locked} minWidth={100} minHeight={60} />
      <SideHandles />
      {editing ? (
        <textarea
          autoFocus
          className="canvas-node-textarea nodrag"
          defaultValue={data.text}
          onBlur={(e) => {
            data.onCommitText?.(e.target.value)
            setEditing(false)
          }}
        />
      ) : rendered ? (
        <CanvasTextContent>
          {rendered}
        </CanvasTextContent>
      ) : selected && !locked ? (
        <div className="canvas-node-text canvas-node-text-placeholder nopan">Empty note — double-click to edit</div>
      ) : (
        <div className="canvas-node-text nopan" />
      )}
    </div>
  )
}

function FileNode({ data, selected }: NodeProps & { data: NodeData }): React.ReactElement {
  const ctx = useContext(CanvasRenderContext)
  const locked = ctx?.locked ?? true
  return (
    <div
      className="canvas-node canvas-node-file-shell"
      style={{ '--node-accent': resolveCanvasColor(data.color) } as React.CSSProperties}
      onDoubleClick={(e) => { e.stopPropagation(); data.onOpenFile?.() }}
    >
      <NodeResizer isVisible={selected && !locked} minWidth={140} minHeight={50} />
      <SideHandles />
      <CanvasFilePreview resolvedPath={data.resolvedPath} fileLabel={data.fileLabel} />
    </div>
  )
}

function LinkNode({ data, selected }: NodeProps & { data: NodeData }): React.ReactElement {
  const ctx = useContext(CanvasRenderContext)
  const locked = ctx?.locked ?? true
  return (
    <div
      className="canvas-node canvas-node-link-shell"
      style={{ '--node-accent': resolveCanvasColor(data.color) } as React.CSSProperties}
    >
      <NodeResizer isVisible={selected && !locked} minWidth={140} minHeight={50} />
      <SideHandles />
      <a href={data.url} target="_blank" rel="noreferrer" className="canvas-node-link nodrag">
        <span className="canvas-node-icon">↗</span>
        {data.url}
      </a>
    </div>
  )
}

function GroupNode({ data, selected }: NodeProps & { data: NodeData }): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const ctx = useContext(CanvasRenderContext)
  const locked = ctx?.locked ?? true
  return (
    <div
      className="canvas-group-shell"
      style={{ '--node-accent': resolveCanvasColor(data.color) } as React.CSSProperties}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
    >
      <NodeResizer isVisible={selected && !locked} minWidth={120} minHeight={80} />
      <SideHandles />
      {editing ? (
        <input
          autoFocus
          className="canvas-group-label-input nodrag"
          defaultValue={data.label}
          onBlur={(e) => {
            data.onCommitLabel?.(e.target.value)
            setEditing(false)
          }}
        />
      ) : (
        <div className="canvas-group-label nodrag">{data.label || 'Group'}</div>
      )}
    </div>
  )
}

// React Flow reserves the literal type name "group" internally for its own
// parent/sub-flow nesting feature — use a distinct internal type so our
// JSON-Canvas "group" nodes don't trip that built-in behavior, and convert
// at the load/save boundary instead.
const CANVAS_GROUP_TYPE = 'canvasGroup'

const nodeTypes: NodeTypes = { text: TextNode, file: FileNode, link: LinkNode, [CANVAS_GROUP_TYPE]: GroupNode }

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const SIDE_TO_POSITION: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left
}

const POSITION_TO_SIDE: [Position, 'top' | 'right' | 'bottom' | 'left'][] = [
  [Position.Top, 'top'],
  [Position.Right, 'right'],
  [Position.Bottom, 'bottom'],
  [Position.Left, 'left']
]

function sideFromPosition(p?: string | null): 'top' | 'right' | 'bottom' | 'left' | undefined {
  return POSITION_TO_SIDE.find(([pos]) => pos === p)?.[1]
}

function CanvasInner({
  content,
  filePath,
  vaultRoot,
  wikiLinkIndex,
  embedIndex,
  variableValues,
  onOpenFile,
  onSave
}: CanvasViewProps): React.ReactElement {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const hasLoaded = useRef(false)
  const skipNextSave = useRef(true)
  const lastSavedContent = useRef<string | null>(null)
  const [parseError, setParseError] = useState(false)
  const [locked, setLocked] = useState(true)
  const tree = useVaultStore((s) => s.tree)
  const [notePickerState, setNotePickerState] = useState<{
    mode: 'file' | 'url'
    resolve: (value: string | null) => void
  } | null>(null)

  function showNotePicker(mode: 'file' | 'url'): Promise<string | null> {
    return new Promise((resolve) => setNotePickerState({ mode, resolve }))
  }

  // Original (or last-saved) raw objects, keyed by id — every save merges
  // React Flow's managed fields (position/size/text/...) back into these
  // instead of re-deriving a fixed field list, so any JSON Canvas field this
  // app doesn't actively manage (subpath, group background, edge fromEnd/
  // toEnd/color/label, anything a future spec version adds) survives the
  // round trip untouched.
  const rawNodesById = useRef(new Map<string, RawCanvasNode>())
  const rawEdgesById = useRef(new Map<string, RawCanvasEdge>())

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Undo/redo history: a stack of full (nodes, edges) snapshots taken right
  // before a discrete edit (drag start, resize start, delete, text commit,
  // add node) — not on every intermediate drag/resize frame.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const pastRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([])
  const futureRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([])
  const isInteractingRef = useRef(false)
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 })

  const syncHistoryCounts = useCallback(() => {
    setHistoryCounts({ past: pastRef.current.length, future: futureRef.current.length })
  }, [])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  const pushHistory = useCallback(() => {
    pastRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    futureRef.current = []
    syncHistoryCounts()
  }, [syncHistoryCounts])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return
    futureRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(previous.nodes)
    setEdges(previous.edges)
    syncHistoryCounts()
  }, [setNodes, setEdges, syncHistoryCounts])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(next.nodes)
    setEdges(next.edges)
    syncHistoryCounts()
  }, [setNodes, setEdges, syncHistoryCounts])

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<NodeData>>[]) => {
      const isRemove = changes.some((c) => c.type === 'remove')
      const isContinuing = changes.some(
        (c) => (c.type === 'position' && c.dragging) || (c.type === 'dimensions' && c.resizing)
      )
      if (isRemove || (isContinuing && !isInteractingRef.current)) pushHistory()
      isInteractingRef.current = isContinuing
      onNodesChange(changes)
    },
    [onNodesChange, pushHistory]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) pushHistory()
      onEdgesChange(changes)
    },
    [onEdgesChange, pushHistory]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory()
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: makeId(),
            className: 'canvas-flow-edge',
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent-dim)' }
          },
          eds
        )
      )
    },
    [setEdges, pushHistory]
  )

  const clipboardRef = useRef<{ nodes: Node<NodeData>[]; edges: Edge[] }>({ nodes: [], edges: [] })

  useEffect(() => {
    function isEditableTarget(el: Element | null): boolean {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return
      if (isEditableTarget(document.activeElement)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      } else if (key === 'c') {
        const selected = nodesRef.current.filter((n) => n.selected)
        if (selected.length === 0) return
        const selectedIds = new Set(selected.map((n) => n.id))
        clipboardRef.current = {
          nodes: selected,
          edges: edgesRef.current.filter((ed) => selectedIds.has(ed.source) && selectedIds.has(ed.target))
        }
      } else if (key === 'v' && !locked) {
        const { nodes: clipNodes, edges: clipEdges } = clipboardRef.current
        if (clipNodes.length === 0) return
        e.preventDefault()
        const idMap = new Map<string, string>()
        const stamp = Date.now()
        const newNodes: Node<NodeData>[] = clipNodes.map((n, i) => {
          const newId = `paste_${stamp}_${i}`
          idMap.set(n.id, newId)
          return { ...n, id: newId, position: { x: n.position.x + 30, y: n.position.y + 30 }, selected: true }
        })
        const newEdges: Edge[] = clipEdges.map((ed, i) => ({
          ...ed,
          id: `paste_edge_${stamp}_${i}`,
          source: idMap.get(ed.source) ?? ed.source,
          target: idMap.get(ed.target) ?? ed.target,
          selected: false
        }))
        pushHistory()
        setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...newNodes])
        if (newEdges.length > 0) setEdges((prev) => [...prev, ...newEdges])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, locked, pushHistory, setNodes, setEdges])

  const openFileFor = useCallback(
    (relativeFile: string) => onOpenFile(resolveRelative(vaultRoot, relativeFile)),
    [vaultRoot, onOpenFile]
  )

  const commitTextFor = useCallback(
    (id: string, text: string) => {
      pushHistory()
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)))
    },
    [setNodes, pushHistory]
  )

  const commitLabelFor = useCallback(
    (id: string, label: string) => {
      pushHistory()
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)))
    },
    [setNodes, pushHistory]
  )

  const buildFileNodeData = useCallback(
    (id: string, file: string): NodeData => ({
      file,
      fileLabel: file.split(/[\\/]/).pop(),
      resolvedPath: resolveRelative(vaultRoot, file),
      onOpenFile: () => openFileFor(file),
      onCommitText: (text: string) => commitTextFor(id, text)
    }),
    [vaultRoot, openFileFor, commitTextFor]
  )

  useEffect(() => {
    if (content === lastSavedContent.current) return

    let parsed: CanvasData
    try {
      const raw = JSON.parse(content)
      parsed = { nodes: raw.nodes ?? [], edges: raw.edges ?? [] }
    } catch {
      if (content.trim().length > 0) setParseError(true)
      return
    }
    setParseError(false)

    rawNodesById.current = new Map(parsed.nodes.map((n) => [n.id, n]))
    rawEdgesById.current = new Map(parsed.edges.map((e) => [e.id, e]))

    const flowNodes: Node<NodeData>[] = parsed.nodes.map((n) => ({
      id: n.id,
      type: n.type === 'group' ? CANVAS_GROUP_TYPE : n.type,
      position: { x: n.x, y: n.y },
      style: { width: n.width, height: n.height },
      zIndex: n.type === 'group' ? -1 : 1,
      data:
        n.type === 'file'
          ? { ...buildFileNodeData(n.id, n.file as string), color: n.color }
          : n.type === 'group'
            ? { label: n.label, color: n.color, onCommitLabel: (label: string) => commitLabelFor(n.id, label) }
            : {
                text: n.text,
                url: n.url,
                color: n.color,
                onCommitText: (text: string) => commitTextFor(n.id, text)
              }
    }))

    const flowEdges: Edge[] = parsed.edges.map((e) => {
      const resolvedColor = resolveCanvasColor(e.color)
      return {
        id: e.id,
        source: e.fromNode,
        target: e.toNode,
        sourceHandle: e.fromSide ? SIDE_TO_POSITION[e.fromSide] : Position.Right,
        targetHandle: e.toSide ? SIDE_TO_POSITION[e.toSide] : Position.Left,
        className: 'canvas-flow-edge',
        style: resolvedColor ? { stroke: resolvedColor } : undefined,
        markerEnd:
          e.toEnd === 'none' ? undefined : { type: MarkerType.ArrowClosed, color: resolvedColor || 'var(--accent-dim)' }
      }
    })

    hasLoaded.current = true
    skipNextSave.current = true
    setNodes(flowNodes)
    setEdges(flowEdges)
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1.5 }), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    if (!hasLoaded.current) return

    const timer = setTimeout(() => {
      const outNodes: RawCanvasNode[] = nodes.map((n) => ({
        ...rawNodesById.current.get(n.id),
        id: n.id,
        type: (n.type === CANVAS_GROUP_TYPE ? 'group' : n.type) as RawCanvasNode['type'],
        x: n.position.x,
        y: n.position.y,
        width: (n.measured?.width ?? (n.style?.width as number)) || 200,
        height: (n.measured?.height ?? (n.style?.height as number)) || 80,
        color: n.data.color,
        text: n.data.text,
        file: n.data.file,
        url: n.data.url,
        label: n.data.label
      }))

      const outEdges: RawCanvasEdge[] = edges.map((e) => ({
        ...rawEdgesById.current.get(e.id),
        id: e.id,
        fromNode: e.source,
        toNode: e.target,
        fromSide: sideFromPosition(e.sourceHandle),
        toSide: sideFromPosition(e.targetHandle)
      }))

      rawNodesById.current = new Map(outNodes.map((n) => [n.id, n]))
      rawEdgesById.current = new Map(outEdges.map((e) => [e.id, e]))

      const json = JSON.stringify({ nodes: outNodes, edges: outEdges }, null, 2)
      lastSavedContent.current = json
      onSave(json)
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  function centerOfView(): { x: number; y: number } {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return center
  }

  function addTextNode(): void {
    const center = centerOfView()
    const id = makeId()
    const newNode: Node<NodeData> = {
      id,
      type: 'text',
      position: { x: center.x - 110, y: center.y - 50 },
      style: { width: 220, height: 100 },
      zIndex: 1,
      selected: true,
      data: { text: 'New note', onCommitText: (text: string) => commitTextFor(id, text) }
    }
    pushHistory()
    setNodes((nds) => [...nds, newNode])
  }

  async function addFileNode(): Promise<void> {
    const file = await showNotePicker('file')
    if (!file) return
    const center = centerOfView()
    const id = makeId()
    const newNode: Node<NodeData> = {
      id,
      type: 'file',
      position: { x: center.x - 110, y: center.y - 40 },
      style: { width: 220, height: 80 },
      zIndex: 1,
      selected: true,
      data: buildFileNodeData(id, file)
    }
    pushHistory()
    setNodes((nds) => [...nds, newNode])
  }

  async function addLinkNode(): Promise<void> {
    const url = await showNotePicker('url')
    if (!url) return
    const center = centerOfView()
    const id = makeId()
    const newNode: Node<NodeData> = {
      id,
      type: 'link',
      position: { x: center.x - 110, y: center.y - 30 },
      style: { width: 220, height: 60 },
      zIndex: 1,
      selected: true,
      data: { url }
    }
    pushHistory()
    setNodes((nds) => [...nds, newNode])
  }

  function addGroupNode(): void {
    const center = centerOfView()
    const id = makeId()
    const newNode: Node<NodeData> = {
      id,
      type: CANVAS_GROUP_TYPE,
      position: { x: center.x - 160, y: center.y - 100 },
      style: { width: 320, height: 200 },
      zIndex: -1,
      selected: true,
      data: { label: 'Group', onCommitLabel: (label: string) => commitLabelFor(id, label) }
    }
    pushHistory()
    setNodes((nds) => [...nds, newNode])
  }

  const renderContext = useMemo<CanvasRenderContextValue>(
    () => ({ filePath, vaultRoot, wikiLinkIndex, embedIndex, variableValues, onNavigate: onOpenFile, locked }),
    [filePath, vaultRoot, wikiLinkIndex, embedIndex, variableValues, onOpenFile, locked]
  )

  if (parseError) {
    return <p className="empty-hint">Could not parse this .canvas file.</p>
  }

  return (
    <CanvasRenderContext.Provider value={renderContext}>
      <div className="canvas-shell">
        <div className="canvas-toolbar">
          <button
            className={`btn btn-compact btn-secondary canvas-lock-btn${locked ? ' canvas-lock-btn-active' : ''}`}
            onClick={() => setLocked((l) => !l)}
            title={locked ? 'Unlock to edit (move, resize, connect)' : 'Lock canvas (read-only)'}
          >
            {locked ? '⊘ Locked' : '✎ Editing'}
          </button>
          {!locked && (
            <>
              <span className="canvas-toolbar-sep" />
              <button className="btn btn-compact btn-secondary" onClick={addTextNode} title="Add text note">+ Text</button>
              <button className="btn btn-compact btn-secondary" onClick={addFileNode} title="Add file node">+ File</button>
              <button className="btn btn-compact btn-secondary" onClick={addLinkNode} title="Add URL link">+ Link</button>
              <button className="btn btn-compact btn-secondary" onClick={addGroupNode} title="Add group">+ Group</button>
              <span className="canvas-toolbar-sep" />
              <button className="btn btn-compact btn-secondary canvas-history-btn" onClick={undo} disabled={historyCounts.past === 0} title="Undo (Ctrl+Z)">↶</button>
              <button className="btn btn-compact btn-secondary canvas-history-btn" onClick={redo} disabled={historyCounts.future === 0} title="Redo (Ctrl+Y)">↷</button>
            </>
          )}
        </div>
        <div className={`canvas-flow-wrapper${locked ? ' canvas-flow-locked' : ''}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            connectionMode={ConnectionMode.Loose}
            nodeTypes={nodeTypes}
            nodesDraggable={!locked}
            nodesConnectable={!locked}
            deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
            fitView
            minZoom={0.2}
            maxZoom={3}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={32} className="canvas-flow-background" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
      {notePickerState && (
        <NotePickerDialog
          mode={notePickerState.mode}
          vaultRoot={vaultRoot}
          tree={tree}
          onSubmit={(value) => { setNotePickerState(null); notePickerState.resolve(value) }}
          onCancel={() => { setNotePickerState(null); notePickerState.resolve(null) }}
        />
      )}
    </CanvasRenderContext.Provider>
  )
}

export default function CanvasView(props: CanvasViewProps): React.ReactElement {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
