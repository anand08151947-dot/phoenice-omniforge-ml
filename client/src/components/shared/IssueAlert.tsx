import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { IssueSeverity } from '../../api/types'
import { useNavigate } from 'react-router-dom'

interface IssueAlertProps {
  id: string
  severity: IssueSeverity
  title: string
  detail: string
  phase: string
  metric?: number
}

const phaseRoutes: Record<string, string> = {
  sampling: '/sampling',
  cleaning: '/cleaning',
  features: '/features',
  selection: '/selection',
  eda: '/eda',
}

const severityMap: Record<IssueSeverity, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
}

export default function IssueAlert({ severity, title, detail, phase, metric }: IssueAlertProps) {
  const navigate = useNavigate()
  const route = phaseRoutes[phase]

  return (
    <Alert
      severity={severityMap[severity]}
      sx={{ mb: 1 }}
      action={
        route ? (
          <Button size="small" onClick={() => navigate(route)} sx={{ whiteSpace: 'nowrap' }}>
            Fix in {phase}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ fontWeight: 700 }}>{title}</AlertTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">{detail}</Typography>
        {metric !== undefined && (
          <Typography variant="caption" sx={{ fontWeight: 700, ml: 'auto' }}>
            {(metric > 1 ? metric.toFixed(0) : (metric * 100).toFixed(1) + '%')}
          </Typography>
        )}
      </Box>
    </Alert>
  )
}
