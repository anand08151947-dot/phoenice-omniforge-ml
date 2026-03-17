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
  _serverHydrated: boolean
  setDataset: (id: string, name: string) => void
  setPhaseStatus: (phase: string, status: PhaseStatus) => void
  toggleTheme: () => void
  setLmStudioOnline: (online: boolean) => void
  setChatOpen: (open: boolean) => void
  hydrateFromServer: (data: {
    dataset_id: string
    dataset_name: string
    phase_status: Record<string, string>
  }) => void
  resetSession: () => void
}

const DEFAULT_PHASES: Record<string, PhaseStatus> = {
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
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set) => ({
      datasetId: null,
      datasetName: null,
      themeMode: 'dark',
      lmStudioOnline: false,
      chatOpen: false,
      _serverHydrated: false,
      phaseStatus: { ...DEFAULT_PHASES },

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

      hydrateFromServer: ({ dataset_id, dataset_name, phase_status }) =>
        set({
          datasetId: dataset_id,
          datasetName: dataset_name,
          _serverHydrated: true,
          phaseStatus: {
            ...DEFAULT_PHASES,
            ...(phase_status as Record<string, PhaseStatus>),
          },
        }),

      resetSession: () =>
        set({
          datasetId: null,
          datasetName: null,
          _serverHydrated: false,
          phaseStatus: { ...DEFAULT_PHASES },
        }),
    }),
    {
      name: 'omniforge-pipeline-v3',
      // Only persist UI preferences — pipeline state comes from the server
      partialize: (state) => ({
        themeMode: state.themeMode,
      }),
    }
  )
)
