import { create } from 'zustand'
import type { VaultTreeNode } from '../../../../electron/main/shared-types'

interface VaultState {
  rootPath: string | null
  tree: VaultTreeNode[]
  activeFilePath: string | null
  setRootPath: (path: string | null) => void
  setTree: (tree: VaultTreeNode[]) => void
  setActiveFilePath: (path: string | null) => void
}

export const useVaultStore = create<VaultState>((set) => ({
  rootPath: null,
  tree: [],
  activeFilePath: null,
  setRootPath: (path) => set({ rootPath: path }),
  setTree: (tree) => set({ tree }),
  setActiveFilePath: (path) => set({ activeFilePath: path })
}))
