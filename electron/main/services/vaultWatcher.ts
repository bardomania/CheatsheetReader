import { watch, type FSWatcher } from 'fs'

// Node's recursive fs.watch is supported on Windows and macOS, which covers
// this app's shipped platforms. Any change under the vault root — made by
// this app or by an external tool (git, another editor, a script) — should
// make the renderer refetch the tree, so the sidebar never goes stale until
// a manual restart.
const IGNORED_SEGMENTS = new Set(['.cheatsheets-app', '.git', 'node_modules'])

let currentWatcher: FSWatcher | null = null
let currentRoot: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function isIgnored(relativePath: string | null): boolean {
  if (!relativePath) return false
  return relativePath.split(/[\\/]/).some((segment) => IGNORED_SEGMENTS.has(segment) || segment.startsWith('.'))
}

export function startWatchingVault(rootPath: string, onChange: () => void): void {
  if (currentRoot === rootPath && currentWatcher) return
  stopWatchingVault()

  try {
    currentWatcher = watch(rootPath, { recursive: true }, (_event, filename) => {
      if (isIgnored(filename)) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(onChange, 250)
    })
    currentRoot = rootPath
  } catch {
    // Watching is a convenience — if the platform/filesystem can't support
    // recursive watch, the manual refresh paths (create/rename/move/delete)
    // still work as before.
    currentWatcher = null
    currentRoot = null
  }
}

export function stopWatchingVault(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  currentWatcher?.close()
  currentWatcher = null
  currentRoot = null
}
