import { visit } from 'unist-util-visit'
import type { Root, Code } from 'mdast'

interface Options {
  collect?: string[]
}

// Stamps the (already variable-resolved) fenced-code text onto the hast
// `code` element as a data-raw attribute, so the React-side CodeBlock
// component can always copy the exact resolved text rather than re-deriving
// it from highlighted markup. Also collects each block's text into
// `collect`, used for the "copy all code blocks" action.
export function remarkCaptureRawCode({ collect }: Options = {}) {
  return (tree: Root): void => {
    visit(tree, 'code', (node: Code) => {
      collect?.push(node.value)
      node.data = {
        ...node.data,
        hProperties: {
          ...(node.data?.hProperties as Record<string, unknown>),
          'data-raw': node.value
        }
      }
    })
  }
}
