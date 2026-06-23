export function dirnameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? '' : normalized.slice(0, idx)
}

export function resolveRelative(baseDir: string, relativePath: string): string {
  if (/^[a-zA-Z]+:\/\//.test(relativePath)) return relativePath // http(s):// etc.
  if (/^[a-zA-Z]:[\\/]/.test(relativePath)) return relativePath // already absolute (C:\...)

  const baseParts = baseDir.split('/').filter(Boolean)
  const relParts = relativePath.replace(/\\/g, '/').split('/')

  for (const part of relParts) {
    if (part === '.' || part === '') continue
    if (part === '..') baseParts.pop()
    else baseParts.push(part)
  }

  return baseParts.join('/')
}
