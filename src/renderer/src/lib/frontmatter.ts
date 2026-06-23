export function getFileTags(content: string): string[] {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return []
  const block = match[1]

  const inline = block.match(/^tags[ \t]*:[ \t]*\[([^\]]*)\]/m)
  if (inline) {
    return inline[1]
      .split(',')
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  const listMatch = block.match(/^tags[ \t]*:[ \t]*\r?\n((?:[ \t]+-[^\r\n]*\r?\n?)+)/m)
  if (listMatch) {
    return listMatch[1]
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }

  return []
}

export function setFileTags(content: string, tags: string[]): string {
  const tagsLine = `tags: [${tags.join(', ')}]`

  const fmMatch = content.match(/^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/)

  if (!fmMatch) {
    if (tags.length === 0) return content
    return `---\n${tagsLine}\n---\n\n${content}`
  }

  const [fullMatch, open, body, close] = fmMatch
  const rest = content.slice(fullMatch.length)

  let newBody = body
    .replace(/^tags[ \t]*:[ \t]*\[[^\]]*\][ \t]*\r?\n?/m, '')
    .replace(/^tags[ \t]*:[ \t]*\r?\n(?:[ \t]+-[^\r\n]*\r?\n?)*/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')

  if (tags.length > 0) {
    newBody = newBody ? `${newBody}\n${tagsLine}` : tagsLine
  }

  if (!newBody.trim()) {
    return rest.replace(/^\n/, '')
  }

  return `${open}${newBody}${close}${rest}`
}
