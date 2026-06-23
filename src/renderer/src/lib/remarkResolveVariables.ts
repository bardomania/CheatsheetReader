import { findAndReplace, type ReplaceFunction } from 'mdast-util-find-and-replace'
import { visit } from 'unist-util-visit'
import type { Root, Code, InlineCode } from 'mdast'
import { PLACEHOLDER_RE, resolve, detectVariableNames } from '../../../../electron/main/services/variableEngine'

interface Options {
  values: Record<string, string>
}

export interface VariablePlaceholderNode {
  type: 'variablePlaceholder'
  value: string
  varName: string
}

export interface VariableResolvedNode {
  type: 'variableResolved'
  value: string
  varName: string
  funcName?: string
}

export function remarkResolveVariables({ values }: Options) {
  return (tree: Root): void => {
    const replacer = (full: string, name: string, funcArg?: string) => {
      const isCall = funcArg !== undefined
      const varName = isCall ? funcArg : name
      const { resolved, missing } = resolve(full, values)
      if (missing.size > 0) {
        const node: VariablePlaceholderNode = { type: 'variablePlaceholder', value: full, varName }
        return node as unknown as ReturnType<ReplaceFunction>
      }
      const node: VariableResolvedNode = {
        type: 'variableResolved',
        value: resolved,
        varName,
        funcName: isCall ? name : undefined
      }
      return node as unknown as ReturnType<ReplaceFunction>
    }

    const matcher = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags)
    findAndReplace(tree, [[matcher, replacer as ReplaceFunction]])

    visit(tree, 'code', (node: Code) => {
      const original = node.value
      const referenced = detectVariableNames(original)
      node.value = resolve(original, values).resolved
      if (referenced.size > 0) {
        const usedVarValues = Object.fromEntries(
          [...referenced].filter(n => n in values).map(n => [n, values[n]])
        )
        node.data = {
          ...node.data,
          hProperties: {
            ...(node.data?.hProperties as Record<string, unknown>),
            'data-original': original,
            'data-var-json': JSON.stringify(usedVarValues)
          }
        }
      }
    })
    visit(tree, 'inlineCode', (node: InlineCode) => {
      node.value = resolve(node.value, values).resolved
    })
  }
}
