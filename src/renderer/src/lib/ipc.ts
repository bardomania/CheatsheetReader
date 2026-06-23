import type { ElectronApi } from '../../../../electron/main/shared-types'

declare global {
  interface Window {
    api: ElectronApi
  }
}

export const api = (): ElectronApi => window.api
