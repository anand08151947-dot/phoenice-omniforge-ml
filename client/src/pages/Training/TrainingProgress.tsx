import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ModelCandidate } from '../../api/types'
import JobProgress from '../../components/shared/JobProgress'

interface TrainingProgressProps {
  candidates: ModelCandidate[]
  currentTrial: number
  totalTrials: number
  elapsedS: number
  remainingS: number
}

function formatTime(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

export default function TrainingProgress({ candidates, currentTrial, totalTrials, elapsedS, remainingS }: TrainingProgressProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Trial</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{currentTrial}/{totalTrials}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Elapsed</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatTime(elapsedS)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Remaining</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{formatTime(remainingS)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Best Score</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {Math.max(...candidates.filter((c) => c.cv_score > 0).map((c) => c.cv_score)).toFixed(4)}
          </Typography>
        </Box>
      </Box>

      {candidates.map((c) => (
        <Box key={c.id} sx={{ mb: 1.5 }}>
          <JobProgress
            label={`${c.model_name} (${c.library})`}
            progress={c.progress}
            status={c.status === 'done' ? 'done' : c.status === 'failed' ? 'failed' : c.status === 'running' ? 'running' : 'pending'}
            eta={c.status === 'running' ? `~${Math.ceil(c.train_time_s * (1 - c.progress / 100))}s` : undefined}
            detail={c.cv_score > 0 ? `CV: ${c.cv_score.toFixed(4)} | F1: ${c.f1.toFixed(4)} | AUC-ROC: ${c.auc_roc.toFixed(4)}` : undefined}
          />
        </Box>
      ))}
    </Box>
  )
}
