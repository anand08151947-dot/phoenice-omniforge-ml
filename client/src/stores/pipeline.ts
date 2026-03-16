import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PhaseStatus = 'pending' | 'running' | 'done' | 'warn'

interface PipelineStore {
  datasetId: string | null
  datasetName: string | null
  themeMode: 'dark' | 'light'
  lmStudioOnline: boolean
  phaseStatus: Record<string, PhaseStatus>
  chatOpen: boolean
  setDataset: (id: string, name: string) => void
  setPhaseStatus: (phase: string, status: PhaseStatus) => void
  toggleTheme: () => void
  setLmStudioOnline: (online: boolean) => void
  setChatOpen: (open: boolean) => void
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set) => ({
      datasetId: null,
      datasetName: null,
      themeMode: 'dark',
      lmStudioOnline: false,
      chatOpen: false,
      phaseStatus: {
        upload: 'pending',
        pii: 'pending',
        profile: 'pending',
        eda: 'pending',
        cleaning: 'pending',
        sampling: 'pending',
        features: 'pending',
        selection: 'pending',
        training: 'pending',
        evaluation: 'pending',
        explain: 'pending',
        deploy: 'pending',
        chat: 'pending',
      },
      setDataset: (id, name) => set({ datasetId: id, datasetName: name }),
      setPhaseStatus: (phase, status) =>
        set((state) => ({
          phaseStatus: { ...state.phaseStatus, [phase]: status },
        })),
      toggleTheme: () =>
        set((state) => ({
          themeMode: state.themeMode === 'dark' ? 'light' : 'dark',
        })),
      setLmStudioOnline: (online) => set({ lmStudioOnline: online }),
      setChatOpen: (open) => set({ chatOpen: open }),
    }),
    { name: 'omniforge-pipeline-v2' }  // bumped to clear stale mock data
  )
)
