// Tracks which vault the renderer currently has open, so every IPC handler
// that touches the filesystem can clamp the path it's given to that root —
// the same defense the HTTP exposure server already applies via pathGuard.ts.
// Set exactly once per vault load, from the one call (`vault.getTree`) that
// only ever runs right after the user picks a folder or the app restores the
// last-opened vault — never from a path derived out of vault content itself.
let activeVaultRoot: string | null = null

export function setActiveVaultRoot(root: string): void {
  activeVaultRoot = root
}

export function getActiveVaultRoot(): string | null {
  return activeVaultRoot
}
