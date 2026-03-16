import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

interface JobProgressProps {
  label: string
  progress: number
  status: 'pending' | 'running' | 'done' | 'failed'
  eta?: string
  detail?: string
}

const statusColor = { pending: 'default', running: 'info', done: 'success', failed: 'error' } as const

export default function JobProgress({ label, progress, status, eta, detail }: JobProgressProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {eta && status === 'running' && <Typography variant="caption" color="text.secondary">ETA: {eta}</Typography>}
          <Chip label={status === 'done' ? '✓ Done' : status === 'failed' ? '✗ Failed' : `${progress}%`} color={statusColor[status]} size="small" />
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={status === 'done' ? 100 : progress}
        color={status === 'failed' ? 'error' : status === 'done' ? 'success' : 'primary'}
        sx={{ height: 6, borderRadius: 3 }}
      />
      {detail && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>{detail}</Typography>}
    </Box>
  )
}
