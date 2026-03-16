import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import type { DataQualityWarning } from '../../api/types'

interface Props {
  warnings: DataQualityWarning[]
}

const severityIcon: Record<string, string> = {
  high: '🚨',
  medium: '⚠️',
  low: 'ℹ️',
}

export default function DataQualityWarnings({ warnings }: Props) {
  if (!warnings.length) return null

  const high = warnings.filter(w => w.severity === 'high')
  const rest = warnings.filter(w => w.severity !== 'high')

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        🧪 Data Quality Warnings
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {[...high, ...rest].map((w, i) => (
          <Alert
            key={i}
            severity={w.severity === 'high' ? 'error' : 'warning'}
            sx={{ py: 0.25, '& .MuiAlert-message': { py: 0.5 } }}
          >
            <Typography variant="caption">
              {severityIcon[w.severity]} {w.message}
            </Typography>
          </Alert>
        ))}
      </Box>
    </Box>
  )
}
