import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  icon?: React.ReactNode
  color?: string
}

export default function MetricCard({ label, value, delta, deltaLabel, icon, color }: MetricCardProps) {
  const positive = delta !== undefined && delta > 0
  return (
    <Box sx={{ p: 2.5, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
        {icon && <Box sx={{ color: color ?? 'primary.main' }}>{icon}</Box>}
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color ?? 'text.primary', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {delta !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
          {positive ? <TrendingUpIcon fontSize="small" color="success" /> : <TrendingDownIcon fontSize="small" color="error" />}
          <Typography variant="caption" color={positive ? 'success.main' : 'error.main'} sx={{ fontWeight: 600 }}>
            {positive ? '+' : ''}{delta}% {deltaLabel}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
