import { create } from 'zustand'
import type { VariableContext } from '../../../../electron/main/shared-types'

interface VariablesState {
  values: Record<string, string>
  usage: Record<string, string[]>
  contexts: VariableContext[]
  activeContext: string | null
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
}

export const useVariablesStore = create<VariablesState>((set) => ({
  values: {},
  usage: {},
  contexts: [],
  activeContext: null,
  setActiveContext: (name) => set({ activeContext: name }),
  setValue: (name, value) =>
    set((state) => ({ values: { ...state.values, [name]: value } })),
  setValues: (values) => set({ values }),
  setUsage: (usage) => set({ usage }),
  setContexts: (contexts) => set({ contexts }),
  addVariable: (name) =>
    set((state) => (name in state.values ? state : { values: { ...state.values, [name]: '' } })),
  removeVariable: (name) =>
    set((state) => {
      const next = { ...state.values }
      delete next[name]
      return { values: next }
    }),
  renameVariable: (oldName, newName) =>
    set((state) => {
      if (oldName === newName || !(oldName in state.values) || newName in state.values) return state
      const next = { ...state.values }
      const value = next[oldName]
      delete next[oldName]
      next[newName] = value
      return { values: next }
    }),
  upsertContext: (context) =>
    set((state) => ({
      contexts: [...state.contexts.filter((c) => c.name !== context.name), context].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    })),
  removeContext: (name) =>
    set((state) => ({ contexts: state.contexts.filter((c) => c.name !== name) }))
}))
