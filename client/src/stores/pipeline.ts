import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PhaseStatus = 'pending' | 'running' | 'done' | 'warn'

interface PipelineStore {
  datasetId: string | null
  datasetName: string | null
  projectId: string | null
  projectName: string | null
  actorName: string | null
  themeMode: 'dark' | 'light'
  lmStudioOnline: boolean
  phaseStatus: Record<string, PhaseStatus>
  chatOpen: boolean
  _serverHydrated: boolean
  setDataset: (id: string, name: string) => void
  setProject: (id: string, name: string) => void
  setActor: (name: string) => void
  clearProject: () => void
  setPhaseStatus: (phase: string, status: PhaseStatus) => void
  toggleTheme: () => void
  setLmStudioOnline: (online: boolean) => void
  setChatOpen: (open: boolean) => void
  hydrateFromServer: (data: {
    dataset_id: string
    dataset_name: string
    phase_status: Record<string, string>
    project_id?: string
    project_name?: string
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
      projectId: null,
      projectName: null,
      actorName: null,
      themeMode: 'dark',
      lmStudioOnline: false,
      chatOpen: false,
      _serverHydrated: false,
      phaseStatus: { ...DEFAULT_PHASES },

      setDataset: (id, name) => set({ datasetId: id, datasetName: name }),

      setProject: (id, name) => set({ projectId: id, projectName: name }),

      setActor: (name) => set({ actorName: name }),

      clearProject: () => set({ projectId: null, projectName: null }),

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

      hydrateFromServer: ({ dataset_id, dataset_name, phase_status, project_id, project_name }) =>
        set((state) => ({
          datasetId: dataset_id,
          datasetName: dataset_name,
          _serverHydrated: true,
          // Only update project if server returned one and we don't already have one selected
          projectId: project_id ?? state.projectId,
          projectName: project_name ?? state.projectName,
          phaseStatus: {
            ...DEFAULT_PHASES,
            ...(phase_status as Record<string, PhaseStatus>),
          },
        })),

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
      // Persist UI preferences + project/actor identity
      partialize: (state) => ({
        themeMode: state.themeMode,
        actorName: state.actorName,
        projectId: state.projectId,
        projectName: state.projectName,
      }),
    }
  )
)

