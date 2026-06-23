import { getFunction } from './functionRegistry'

// {{ VAR }} or {{ FUNC(VAR) }}. The optional comma-separated tail is parsed
// but unused for now — reserved so multi-arg functions (replace, shellquote)
// can be added later without touching this regex again.
export const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_]\w*)\s*(?:\(\s*([a-zA-Z_]\w*)\s*(?:,([^)]*))?\)\s*)?\}\}/g

export interface ResolveResult {
  resolved: string
  missing: Set<string>
}

export function resolve(text: string, values: Record<string, string>): ResolveResult {
  const missing = new Set<string>()

  // A fresh regex instance per call: PLACEHOLDER_RE is global and stateful
  // (mutates .lastIndex), and resolve() can be invoked re-entrantly (e.g. from
  // inside another consumer that is itself mid-iteration over PLACEHOLDER_RE).
  // Sharing the single module-level instance across nested calls corrupts
  // .lastIndex and can spin into a non-terminating loop.
  const matcher = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags)

  const resolved = text.replace(matcher, (full, name: string, funcArg?: string) => {
    const isCall = funcArg !== undefined
    const varName = isCall ? funcArg : name
    const raw = values[varName]

    if (raw === undefined) {
      missing.add(varName)
      return full
    }

    if (!isCall) return raw

    const fn = getFunction(name)
    return fn ? fn(raw) : full
  })

  return { resolved, missing }
}

export function detectVariableNames(text: string): Set<string> {
  const names = new Set<string>()
  const matcher = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags)
  for (const match of text.matchAll(matcher)) {
    const [, name, funcArg] = match
    names.add(funcArg ?? name)
  }
  return names
}
