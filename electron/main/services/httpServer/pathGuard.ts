import { resolve, sep } from 'path'

// True only if `candidate` resolves to vaultRoot itself or a path strictly
// inside it. Used to clamp every client-supplied path before it reaches
// fs operations — the HTTP API must never be able to read/write outside the
// one vault the exposed instance was configured for.
export function isWithinVault(vaultRoot: string, candidate: string): boolean {
  const resolvedRoot = resolve(vaultRoot)
  const resolvedCandidate = resolve(vaultRoot, candidate)
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + sep)
}

export function resolveWithinVault(vaultRoot: string, candidate: string): string | null {
  const resolvedRoot = resolve(vaultRoot)
  const resolvedCandidate = resolve(vaultRoot, candidate)
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(resolvedRoot + sep)) return null
  return resolvedCandidate
}
