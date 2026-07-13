import { create } from 'zustand'
import type { VariableContext } from '../../../../electron/main/shared-types'

interface VariablesState {
  values: Record<string, string>
  usage: Record<string, string[]>
  contexts: VariableContext[]
  activeContext: string | null
  order: string[]
  presets: Record<string, string[]>
  setValue: (name: string, value: string) => void
  setValues: (values: Record<string, string>) => void
  setUsage: (usage: Record<string, string[]>) => void
  setContexts: (contexts: VariableContext[]) => void
  setActiveContext: (name: string | null) => void
  upsertContext: (context: VariableContext) => void
  removeContext: (name: string) => void
  addVariable: (name: string) => void
  removeVariable: (name: string) => void
  renameVariable: (oldName: string, newName: string) => void
  setOrder: (order: string[]) => void
  setPresets: (presets: Record<string, string[]>) => void
  reorderVariables: (fromIdx: number, toIdx: number) => void
  setVariablePresets: (name: string, presets: string[]) => void
}

export const useVariablesStore = create<VariablesState>((set) => ({
  values: {},
  usage: {},
  contexts: [],
  activeContext: null,
  order: [],
  presets: {},
  setActiveContext: (name) => set({ activeContext: name }),
  setValue: (name, value) =>
    set((state) => ({ values: { ...state.values, [name]: value } })),
  setValues: (values) => set({ values }),
  setUsage: (usage) => set({ usage }),
  setContexts: (contexts) => set({ contexts }),
  setOrder: (order) => set({ order }),
  setPresets: (presets) => set({ presets }),
  addVariable: (name) =>
    set((state) => {
      if (name in state.values) return state
      return { values: { ...state.values, [name]: '' }, order: [...state.order, name] }
    }),
  removeVariable: (name) =>
    set((state) => {
      const nextValues = { ...state.values }
      delete nextValues[name]
      const nextPresets = { ...state.presets }
      delete nextPresets[name]
      return { values: nextValues, order: state.order.filter((n) => n !== name), presets: nextPresets }
    }),
  renameVariable: (oldName, newName) =>
    set((state) => {
      if (oldName === newName || !(oldName in state.values) || newName in state.values) return state
      const nextValues = { ...state.values }
      const value = nextValues[oldName]
      delete nextValues[oldName]
      nextValues[newName] = value
      const nextOrder = state.order.map((n) => (n === oldName ? newName : n))
      const nextPresets = { ...state.presets }
      if (oldName in nextPresets) {
        nextPresets[newName] = nextPresets[oldName]
        delete nextPresets[oldName]
      }
      return { values: nextValues, order: nextOrder, presets: nextPresets }
    }),
  reorderVariables: (fromIdx, toIdx) =>
    set((state) => {
      if (fromIdx === toIdx) return state
      const next = [...state.order]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return { order: next }
    }),
  setVariablePresets: (name, presetList) =>
    set((state) => ({ presets: { ...state.presets, [name]: presetList } })),
  upsertContext: (context) =>
    set((state) => ({
      contexts: [...state.contexts.filter((c) => c.name !== context.name), context].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    })),
  removeContext: (name) =>
    set((state) => ({ contexts: state.contexts.filter((c) => c.name !== name) }))
}))
