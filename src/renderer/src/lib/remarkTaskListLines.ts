import { visit } from 'unist-util-visit'
import type { Root, ListItem } from 'mdast'

// Stamps each GFM task-list item with its source line, so the React side can
// turn the (otherwise read-only) checkbox into one that edits the right line
// of the raw markdown — without reimplementing remark-rehype's listItem
// handler (nested lists/paragraphs inside items keep working as-is).
export function remarkTaskListLines() {
  return (tree: Root): void => {
    visit(tree, 'listItem', (node: ListItem) => {
      if (node.checked == null || !node.position) return
      node.data = {
        ...node.data,
        hProperties: {
          ...(node.data?.hProperties as Record<string, unknown>),
          'data-line': node.position.start.line
        }
      }
    })
  }
}
