import { Children, cloneElement, isValidElement } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import rehypeReact from 'rehype-react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { dirnameOf, resolveRelative } from './paths'
import { vaultAssetUrl } from './vaultAssetUrl'
import { remarkWikiLink } from './remarkWikiLink'
import { resolveEmbedTarget, type FilePathIndex } from './wikiLinks'
import { remarkCaptureRawCode } from './remarkCaptureRawCode'
import { remarkResolveVariables } from './remarkResolveVariables'
import { remarkTaskListLines } from './remarkTaskListLines'
import { remarkCallout, calloutIcon } from './remarkCallout'
import PreBlock from '../components/editor/CodeBlock'
import WikiEmbed from '../components/editor/WikiEmbed'

export interface MarkdownRenderOptions {
  content: string
  filePath: string
  vaultRoot: string
  wikiLinkIndex: FilePathIndex
  embedIndex: FilePathIndex
  variableValues: Record<string, string>
  onNavigate: (filePath: string) => void
  collectCodeBlocks?: boolean
  onToggleCheckbox?: (lineIndex: number) => void
}

export interface MarkdownRenderResult {
  element: React.ReactElement
  codeBlocks: string[]
}

function decodeWikiHref(href: string): { status: string; value: string } | null {
  const match = href.match(/^wikilink:\/\/(resolved|ambiguous|missing)\/(.+)$/)
  if (!match) return null
  return { status: match[1], value: decodeURIComponent(match[2]) }
}

function decodeEmbedHref(
  href: string
): { status: 'resolved' | 'ambiguous' | 'missing'; value: string; width?: number; page?: number; height?: number } | null {
  const match = href.match(/^wikiembed:\/\/(resolved|ambiguous|missing)\/([^?]+)(?:\?(.*))?$/)
  if (!match) return null
  const params = new URLSearchParams(match[3] ?? '')
  return {
    status: match[1] as 'resolved' | 'ambiguous' | 'missing',
    value: decodeURIComponent(match[2]),
    width: params.has('w') ? Number(params.get('w')) : undefined,
    page: params.has('page') ? Number(params.get('page')) : undefined,
    height: params.has('h') ? Number(params.get('h')) : undefined
  }
}

function isExternalAsset(src: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(src) || /^(data|blob):/.test(src) || src.startsWith('#')
}

// Shared by the full-page markdown preview and canvas text-card rendering, so
// wiki-links/embeds/variables resolve identically everywhere markdown shows up.
export function renderMarkdown({
  content,
  filePath,
  vaultRoot,
  wikiLinkIndex,
  embedIndex,
  variableValues,
  onNavigate,
  collectCodeBlocks = true,
  onToggleCheckbox
}: MarkdownRenderOptions): MarkdownRenderResult {
  const fileDir = dirnameOf(filePath)
  const codeBlocks: string[] = []

  const processor = unified()
    .use(remarkParse)
    .use(remarkCallout)  // before remarkGfm so [!type] blockquotes are claimed first
    .use(remarkGfm)
    .use(remarkTaskListLines)
    .use(remarkWikiLink, { wikiLinkIndex, embedIndex, vaultRoot, fromFilePath: filePath })
    .use(remarkResolveVariables, { values: variableValues })

  if (collectCodeBlocks) processor.use(remarkCaptureRawCode, { collect: codeBlocks })

  processor
    .use(remarkRehype, {
      handlers: {
        variablePlaceholder: (_state: unknown, node: { value: string; varName: string }) => ({
          type: 'element',
          tagName: 'span',
          properties: { className: ['var-missing'], title: `{{${node.varName}}} — not set` },
          children: [{ type: 'text', value: node.value }]
        }),
        variableResolved: (_state: unknown, node: { value: string; varName: string; funcName?: string }) => ({
          type: 'element',
          tagName: 'span',
          properties: {
            className: ['var-resolved'],
            title: node.funcName ? `{{${node.funcName}(${node.varName})}}` : `{{${node.varName}}}`
          },
          children: [{ type: 'text', value: node.value }]
        }),
        callout: (state: any, node: any) => ({
          type: 'element',
          tagName: 'div',
          properties: { className: ['callout', `callout-${node.calloutType}`] },
          children: [
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['callout-title'] },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['callout-icon'], 'aria-hidden': 'true' },
                  children: [{ type: 'text', value: calloutIcon(node.calloutType) }]
                },
                { type: 'text', value: node.calloutTitle }
              ]
            },
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['callout-body'] },
              children: state.all(node)
            }
          ]
        })
      }
    })
    .use(rehypeHighlight)
    .use(rehypeReact, {
      Fragment,
      jsx,
      jsxs,
      components: {
        img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
          if (!props.src || isExternalAsset(props.src)) return <img {...props} />

          const resolution =
            props.src.includes('/') || props.src.includes('\\')
              ? { status: 'resolved' as const, path: resolveRelative(fileDir, props.src) }
              : resolveEmbedTarget(embedIndex, props.src, vaultRoot, filePath)

          if (resolution.status === 'missing') {
            return (
              <span className="wiki-embed wiki-embed-missing" title={`Image not found: ${resolution.name}`}>
                Missing image: {resolution.name}
              </span>
            )
          }

          return (
            <img
              {...props}
              src={vaultAssetUrl(resolution.path)}
              title={resolution.status === 'ambiguous' ? `Ambiguous image: ${props.src}` : props.title}
            />
          )
        },
        pre: PreBlock,
        li: (props: React.LiHTMLAttributes<HTMLLIElement> & { 'data-line'?: string }) => {
          const dataLine = props['data-line']
          if (dataLine === undefined || !onToggleCheckbox) return <li {...props} />

          const lineIndex = Number(dataLine) - 1
          const children = Children.map(props.children, (child) => {
            if (
              isValidElement(child) &&
              child.type === 'input' &&
              (child.props as React.InputHTMLAttributes<HTMLInputElement>).type === 'checkbox'
            ) {
              return cloneElement(child as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>, {
                disabled: false,
                onChange: () => onToggleCheckbox(lineIndex)
              })
            }
            return child
          })

          return <li {...props}>{children}</li>
        },
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          const embedDecoded = props.href ? decodeEmbedHref(props.href) : null
          if (embedDecoded) return <WikiEmbed {...embedDecoded} />

          const decoded = props.href ? decodeWikiHref(props.href) : null
          if (!decoded) return <a {...props} target="_blank" rel="noreferrer" />

          if (decoded.status === 'missing') {
            return (
              <span className="wiki-link wiki-link-missing" title={`No cheatsheet named "${decoded.value}" yet`}>
                {props.children}
              </span>
            )
          }

          return (
            <a
              {...props}
              href={undefined}
              className={props.className}
              title={decoded.status === 'ambiguous' ? 'Ambiguous link — opening first match' : undefined}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(decoded.value)
              }}
            />
          )
        }
      }
    })

  const element = processor.processSync(content).result as React.ReactElement
  return { element, codeBlocks }
}
