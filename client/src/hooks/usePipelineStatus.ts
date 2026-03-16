import { usePipelineStore } from '../stores/pipeline'

export function usePipelineStatus() {
  const phaseStatus = usePipelineStore((s) => s.phaseStatus)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)

  const getStatus = (phase: string) => phaseStatus[phase] ?? 'pending'
  const isDone = (phase: string) => phaseStatus[phase] === 'done'
  const isRunning = (phase: string) => phaseStatus[phase] === 'running'
  const isPending = (phase: string) => phaseStatus[phase] === 'pending'
  const hasWarn = (phase: string) => phaseStatus[phase] === 'warn'

  return { phaseStatus, setPhaseStatus, getStatus, isDone, isRunning, isPending, hasWarn }
}
