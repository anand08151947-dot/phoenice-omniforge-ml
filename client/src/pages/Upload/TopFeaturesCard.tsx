import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { TopFeature } from '../../api/types'

interface Props {
  features: TopFeature[]
  targetCol: string
}

export default function TopFeaturesCard({ features, targetCol }: Props) {
  if (!features.length) return null
  const max = features[0]?.correlation ?? 1

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        🔬 Top Features Correlated with <em>{targetCol}</em>
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {features.slice(0, 8).map((f, i) => {
          const pct = (f.correlation / max) * 100
          const color = f.correlation > 0.85 ? '#f44336' : f.correlation > 0.5 ? '#ff9800' : '#4caf50'
          return (
            <Box key={f.feature}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                <Typography variant="caption" fontWeight={600}>
                  {i + 1}. {f.feature}
                </Typography>
                <Tooltip title={f.correlation > 0.85 ? 'Very high — possible leakage' : 'Predictive signal'}>
                  <Typography variant="caption" sx={{ color, fontWeight: 700, cursor: 'help' }}>
                    ρ = {f.correlation.toFixed(3)}
                    {f.correlation > 0.85 ? ' 🚨' : ''}
                  </Typography>
                </Tooltip>
              </Box>
              <Box sx={{ height: 5, borderRadius: 2.5, bgcolor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 2.5 }} />
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
