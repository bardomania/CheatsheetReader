import { promises as fs } from 'fs'
import { join, dirname, basename, relative } from 'path'

const IGNORED = new Set(['.cheatsheets-app', '.git', 'node_modules'])

// File types worth scanning for outbound references
const SCANNABLE = /\.(md|canvas)$/i
// File types we track as link targets (embeds, canvas file-nodes, rel links)
const LINKABLE = /\.(md|canvas|png|jpe?g|gif|svg|webp|bmp|pdf)$/i

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function toUnix(p: string): string {
  return p.replace(/\\/g, '/')
}

async function walkFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()!
    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try { entries = await fs.readdir(current, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (IGNORED.has(e.name) || e.name.startsWith('.')) continue
      const full = join(current, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (e.isFile() && SCANNABLE.test(e.name)) results.push(full)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Wiki-link / embed patch (operates on markdown text)
//
// Resolution rules (mirrors wikiLinks.ts):
//   [[stem]]          → resolved by basename stem (case-insensitive)
//   [[path/stem]]     → still resolved by stem only (path is cosmetic)
//   ![[stem.ext]]     → resolved by basename
//   ![[folder/f.ext]] → vault-root-relative (path-like embeds are absolute)
// ---------------------------------------------------------------------------
function patchWikiRefs(
  content: string,
  oldStem: string,
  newStem: string,
  oldVaultRel: string,
  newVaultRel: string,
  stemChanged: boolean
): string {
  // !?[[ target-no-frag  #fragment?  |alias?  ]]
  return content.replace(
    /(!?\[\[)([^\]|#\n]+)(#[^\]|\n]*)?(\|[^\]\n]*)?(\]\])/g,
    (match, open, rawTarget, fragment, alias, close) => {
      const bang = open.includes('!')
      const target = rawTarget.trim()
      const frag = fragment ?? ''
      const ali = alias ?? ''

      // Path-like embed (![[folder/file.ext]]): vault-root-relative path
      if (bang && (target.includes('/') || target.includes('\\'))) {
        if (toUnix(target).toLowerCase() === oldVaultRel.toLowerCase()) {
          return `${open}${newVaultRel}${frag}${ali}${close}`
        }
        return match
      }

      // Wiki-link or bare embed: resolved by last path-segment stem only
      if (!stemChanged) return match
      const segments = target.split('/')
      const last = segments[segments.length - 1]
      const lastStem = stemOf(last)
      if (lastStem.toLowerCase() !== oldStem.toLowerCase()) return match
      const ext = last.slice(lastStem.length) // preserve ".md" / ".canvas" suffix if present
      segments[segments.length - 1] = newStem + ext
      return `${open}${segments.join('/')}${frag}${ali}${close}`
    }
  )
}

// ---------------------------------------------------------------------------
// Relative markdown link patch  [text](./relative/path.md#anchor)
// ---------------------------------------------------------------------------
function patchRelLinks(
  content: string,
  fileDir: string,
  oldAbsPath: string,
  newAbsPath: string
): string {
  return content.replace(
    /(\[[^\]\n]*\]\()([^)\n]+)(\))/g,
    (match, open, href, close) => {
      // Skip absolute URLs, fragment-only, and data URIs
      if (/^[a-z][a-z\d+.-]*:|^#|^\//.test(href)) return match
      try {
        const [hrefPath, ...anchorParts] = href.split('#')
        const anchor = anchorParts.length ? '#' + anchorParts.join('#') : ''
        const abs = toUnix(join(fileDir, hrefPath))
        if (abs.toLowerCase() !== toUnix(oldAbsPath).toLowerCase()) return match
        const newRel = toUnix(relative(fileDir, newAbsPath))
        return `${open}${newRel.startsWith('.') ? newRel : './' + newRel}${anchor}${close}`
      } catch {
        return match
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface UpdateRefsResult {
  changedFiles: string[]
}

export async function updateRefs(
  vaultRoot: string,
  oldAbsPath: string,
  newAbsPath: string
): Promise<UpdateRefsResult> {
  // Only handle individual files with known extensions, not folders
  if (!LINKABLE.test(oldAbsPath)) return { changedFiles: [] }

  const oldName = basename(oldAbsPath)
  const newName = basename(newAbsPath)
  const oldStem = stemOf(oldName)
  const newStem = stemOf(newName)
  const oldVaultRel = toUnix(relative(vaultRoot, oldAbsPath))
  const newVaultRel = toUnix(relative(vaultRoot, newAbsPath))
  const stemChanged = oldStem.toLowerCase() !== newStem.toLowerCase()
  const pathChanged = oldVaultRel.toLowerCase() !== newVaultRel.toLowerCase()

  if (!pathChanged) return { changedFiles: [] }

  const changed = new Set<string>()
  const allFiles = await walkFiles(vaultRoot)

  for (const fp of allFiles) {
    // Skip the file at its new location (we handle it separately below)
    if (toUnix(fp).toLowerCase() === toUnix(newAbsPath).toLowerCase()) continue

    if (fp.toLowerCase().endsWith('.canvas')) {
      // Canvas: update file-node paths + wiki-links inside text nodes
      let raw: string
      try { raw = await fs.readFile(fp, 'utf-8') } catch { continue }
      let json: { nodes?: { type?: string; file?: string; text?: string }[]; [k: string]: unknown }
      try { json = JSON.parse(raw) } catch { continue }

      let dirty = false
      if (Array.isArray(json.nodes)) {
        for (const node of json.nodes) {
          if (node.type === 'file' && typeof node.file === 'string') {
            if (toUnix(node.file).toLowerCase() === oldVaultRel.toLowerCase()) {
              node.file = newVaultRel
              dirty = true
            }
          }
          if (node.type === 'text' && typeof node.text === 'string') {
            const patched = patchWikiRefs(node.text, oldStem, newStem, oldVaultRel, newVaultRel, stemChanged)
            if (patched !== node.text) {
              node.text = patched
              dirty = true
            }
          }
        }
      }

      if (dirty) {
        await fs.writeFile(fp, JSON.stringify(json, null, '\t'), 'utf-8')
        changed.add(fp)
      }
    } else {
      // Markdown: wiki-links + embeds + relative links
      let raw: string
      try { raw = await fs.readFile(fp, 'utf-8') } catch { continue }
      let content = raw
      content = patchWikiRefs(content, oldStem, newStem, oldVaultRel, newVaultRel, stemChanged)
      content = patchRelLinks(content, dirname(fp), oldAbsPath, newAbsPath)
      if (content !== raw) {
        await fs.writeFile(fp, content, 'utf-8')
        changed.add(fp)
      }
    }
  }

  // When the file itself was MOVED to a new folder, its own relative links
  // now point to wrong targets (still relative to the old directory).
  // Recompute each relative link so it resolves to the same absolute target
  // from the new directory.
  const oldDir = dirname(oldAbsPath)
  const newDir = dirname(newAbsPath)
  if (toUnix(oldDir).toLowerCase() !== toUnix(newDir).toLowerCase() && newAbsPath.toLowerCase().endsWith('.md')) {
    try {
      const raw = await fs.readFile(newAbsPath, 'utf-8')
      const content = raw.replace(
        /(\[[^\]\n]*\]\()([^)\n]+)(\))/g,
        (match, open, href, close) => {
          if (/^[a-z][a-z\d+.-]*:|^#|^\//.test(href)) return match
          try {
            const [hrefPath, ...anchorParts] = href.split('#')
            const anchor = anchorParts.length ? '#' + anchorParts.join('#') : ''
            // What absolute target did this link point to from the old location?
            const absTarget = toUnix(join(oldDir, hrefPath))
            // What relative path reaches that target from the new location?
            const newRel = toUnix(relative(newDir, absTarget))
            if (newRel === toUnix(hrefPath)) return match
            return `${open}${newRel.startsWith('.') ? newRel : './' + newRel}${anchor}${close}`
          } catch { return match }
        }
      )
      if (content !== raw) {
        await fs.writeFile(newAbsPath, content, 'utf-8')
        changed.add(newAbsPath)
      }
    } catch { /* file might not exist yet in edge cases */ }
  }

  return { changedFiles: [...changed] }
}
