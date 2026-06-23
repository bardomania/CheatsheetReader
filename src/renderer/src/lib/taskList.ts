const TASK_LINE_RE = /^(\s*[-*+]\s+\[)([ xX])(\]\s*)/

// Flips `- [ ]` <-> `- [x]` on a single line of raw markdown, leaving
// everything else byte-identical — used by both Preview-mode checkbox
// clicks and the CodeMirror live-preview editor's checkbox widget.
export function toggleTaskListLine(content: string, lineIndex: number): string {
  const lines = content.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return content

  const match = line.match(TASK_LINE_RE)
  if (!match) return content

  const isChecked = match[2].toLowerCase() === 'x'
  lines[lineIndex] = line.replace(TASK_LINE_RE, `$1${isChecked ? ' ' : 'x'}$3`)
  return lines.join('\n')
}
