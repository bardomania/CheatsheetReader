import { vaultAssetUrl } from '../../lib/vaultAssetUrl'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

interface WikiEmbedProps {
  status: 'resolved' | 'ambiguous' | 'missing'
  value: string
  width?: number
  page?: number
  height?: number
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export default function WikiEmbed({ status, value, width, page, height }: WikiEmbedProps): React.ReactElement {
  if (status === 'missing') {
    return (
      <span className="wiki-embed wiki-embed-missing" title={`No file named "${value}" found`}>
        Missing embed: {value}
      </span>
    )
  }

  const ext = extensionOf(value)
  const src = vaultAssetUrl(value)
  const title = status === 'ambiguous' ? 'Ambiguous embed — showing first match' : undefined

  if (IMAGE_EXTENSIONS.has(ext)) {
    return <img className="wiki-embed" src={src} title={title} style={width ? { width } : undefined} />
  }

  if (ext === 'pdf') {
    return (
      <iframe
        className="wiki-embed wiki-embed-pdf"
        src={`${src}${page ? `#page=${page}` : ''}`}
        title={title ?? 'Embedded PDF'}
        style={{ width: '100%', height: `${height ?? 600}px`, border: 'none' }}
      />
    )
  }

  return (
    <span className="wiki-embed wiki-embed-unsupported" title={title}>
      📎 {value.split(/[\\/]/).pop()} — preview not supported
    </span>
  )
}
