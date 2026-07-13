import { useRef } from 'react'
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

interface ExcalidrawViewProps {
  content: string
  filePath: string
  onSave: (json: string) => void
}

function parseInitialData(content: string) {
  try {
    const parsed = JSON.parse(content)
    return {
      elements: parsed.elements ?? [],
      appState: parsed.appState ?? {},
      files: parsed.files ?? {}
    }
  } catch {
    return { elements: [], appState: {}, files: {} }
  }
}

export default function ExcalidrawView({ content, filePath, onSave }: ExcalidrawViewProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialData = useRef(parseInitialData(content))

  function handleChange(elements: any, appState: any, files: any): void {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const json = serializeAsJSON(elements, appState, files, 'local')
      onSave(json)
    }, 1500)
  }

  return (
    <div key={filePath} className="excalidraw-view">
      <Excalidraw
        initialData={initialData.current}
        onChange={handleChange}
        theme="dark"
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: false,
            export: false
          }
        }}
      />
    </div>
  )
}
