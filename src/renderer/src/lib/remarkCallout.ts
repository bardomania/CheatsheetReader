import { visit } from 'unist-util-visit'
import type { Root, Blockquote, Text } from 'mdast'

const CALLOUT_RE = /^\[!([\w-]+)\]\s*([^\n]*)/

export function remarkCallout() {
  return (tree: Root): void => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (first?.type !== 'paragraph') return

      const firstInline = first.children[0]
      if (!firstInline) return

      let calloutType = ''
      let titleSuffix = ''

      if (firstInline.type === 'text') {
        // remark-parse emits the fallback literal text "[!type] rest" as a single text node
        const m = (firstInline as Text).value.match(CALLOUT_RE)
        if (!m) return
        calloutType = m[1].toLowerCase()
        titleSuffix = m[2].trim()

        const after = (firstInline as Text).value.slice(m[0].length).replace(/^\n/, '')
        if (after.trim()) {
          (firstInline as Text).value = after
        } else {
          first.children.splice(first.children.indexOf(firstInline), 1)
          if (first.children[0]?.type === 'break') first.children.shift()
        }
      } else if (firstInline.type === 'linkReference') {
        // remark-parse v11 can produce a linkReference node for [!type] when no
        // matching definition exists. The identifier is "!type" (e.g. "!info").
        const ref = firstInline as any
        const identifier: string = ref.identifier ?? ref.label ?? ''
        if (!identifier.startsWith('!')) return
        calloutType = identifier.slice(1).toLowerCase()
        if (!calloutType) return

        // Inline title text may follow as a sibling: e.g. " Theory"
        const nextSibling = first.children[1]
        if (nextSibling?.type === 'text') {
          titleSuffix = (nextSibling as Text).value.trimStart()
          first.children.splice(0, 2)
        } else {
          first.children.splice(0, 1)
        }
        if (first.children[0]?.type === 'break') first.children.shift()
      } else {
        return
      }

      const calloutTitle = titleSuffix || calloutType.charAt(0).toUpperCase() + calloutType.slice(1)

      if (first.children.length === 0) node.children.shift()

      ;(node as any).type = 'callout'
      ;(node as any).calloutType = calloutType
      ;(node as any).calloutTitle = calloutTitle
    })
  }
}

const ICONS: Record<string, string> = {
  note: '✎',
  info: 'ℹ',
  tip: '⟡', hint: '⟡', important: '⟡',
  warning: '⚠', caution: '⚠', attention: '⚠',
  danger: '✕', error: '✕',
  success: '✓', check: '✓', done: '✓',
  question: '?', help: '?', faq: '?',
  quote: '"', cite: '"',
  abstract: '◈', summary: '◈', tldr: '◈',
  todo: '○',
  bug: '⚑',
  example: '≡',
  failure: '✕', fail: '✕', missing: '✕',
}

export function calloutIcon(type: string): string {
  return ICONS[type] ?? '◆'
}
