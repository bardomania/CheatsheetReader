type VarFunction = (value: string) => string

const registry = new Map<string, VarFunction>()

export function registerFunction(name: string, fn: VarFunction): void {
  registry.set(name, fn)
}

export function getFunction(name: string): VarFunction | undefined {
  return registry.get(name)
}

// This module is imported by both the Electron main process and the renderer
// bundle (so the resolution logic stays identical everywhere), hence the
// Buffer-vs-btoa branch instead of a hard Node dependency.
function toBase64(value: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf-8').toString('base64')
  return btoa(unescape(encodeURIComponent(value)))
}

registerFunction('lower', (v) => v.toLowerCase())
registerFunction('upper', (v) => v.toUpperCase())
registerFunction('base64', toBase64)
registerFunction('urlencode', (v) => encodeURIComponent(v))
