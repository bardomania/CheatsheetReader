export async function writeClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function toOneLiner(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' && ')
}

export function extractCodeBlocks(markdown: string): string[] {
  const blocks: string[] = []
  const re = /```[^\n]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    blocks.push(match[1].replace(/\n$/, ''))
  }
  return blocks
}
