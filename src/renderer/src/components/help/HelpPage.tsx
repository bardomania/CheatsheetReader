interface HelpPageProps {
  onClose: () => void
}

export default function HelpPage({ onClose }: HelpPageProps) {
  return (
    <div className="help-page">
      <div className="help-header">
        <h2>Help</h2>
        <button className="btn btn-secondary btn-compact" onClick={onClose}>Close</button>
      </div>
      <div className="help-content">
        <section>
          <h3>Variables</h3>
          <p>
            Write <code>{'{{NAME}}'}</code> anywhere in a cheatsheet — including inside code blocks — and it shows up
            in the Variables panel on the right. Set a value there and the preview, copies, and the Commands view all
            substitute it live. Unset variables are highlighted with a warning until you set them.
          </p>
          <p>
            Functions transform a variable before substitution: <code>{'{{lower(DOMAIN)}}'}</code>,{' '}
            <code>{'{{upper(USER)}}'}</code>, <code>{'{{base64(PAYLOAD)}}'}</code>, <code>{'{{urlencode(CMD)}}'}</code>.
          </p>
        </section>
        <section>
          <h3>Contexts</h3>
          <p>
            Save the current set of variable values as a named context (e.g. one per engagement) and switch between
            them from the Variables panel. Export/import the whole set as JSON to share or back up.
          </p>
        </section>
        <section>
          <h3>Wiki-links</h3>
          <p>
            <code>{'[[note]]'}</code> or <code>{'[[note|alias]]'}</code> links to another cheatsheet by name. Resolved
            links are clickable; ambiguous matches open the first candidate; missing targets are shown in a distinct
            style.
          </p>
        </section>
        <section>
          <h3>Code blocks</h3>
          <p>
            Hover a code block for a copy button. Right-click for block/line/one-liner copy, or select text and
            right-click to copy just the selection. Copies always use the resolved (variables substituted) text.
            "Copy all code blocks" at the top of a page copies every block on the current file.
          </p>
        </section>
        <section>
          <h3>Managing cheatsheets</h3>
          <p>
            Right-click the sidebar (or empty space) to create a cheatsheet or folder, optionally from a built-in
            template. Drag and drop to move items. Deleted items go to Trash (top bar) and can be restored or purged
            permanently.
          </p>
        </section>
        <section>
          <h3>Editing</h3>
          <p>
            Toggle Edit/Preview from the header. Save with the Save button or Ctrl+S. Enable autosave with a custom
            interval. Closing a file or the app with unsaved changes asks for confirmation first.
          </p>
        </section>
        <section>
          <h3>Search &amp; Commands</h3>
          <p>
            Search (top bar) looks across all cheatsheets, with a toggle to restrict matches to code blocks only. The
            Commands view (per-file, header button) strips a cheatsheet down to just its resolved, copyable commands.
          </p>
        </section>
        <section>
          <h3>Atlas</h3>
          <p>
            A treemap overview of the vault — tile size reflects content length, color reflects an auto-detected
            concept (tool name or folder). Filter by concept, click a tile to open it, right-click for the same
            actions as the sidebar, or click empty space to create a new cheatsheet.
          </p>
        </section>
        <section>
          <h3>.canvas boards</h3>
          <p>Obsidian-style .canvas files are rendered read-only: pan with drag, zoom with the scroll wheel.</p>
        </section>
      </div>
    </div>
  )
}
