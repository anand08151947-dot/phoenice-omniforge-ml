import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { FeaturePreviewItem } from '../../api/types'

const TYPE_COLORS: Record<string, string> = {
  numeric: '#1976d2',
  categorical: '#7b1fa2',
  datetime: '#0288d1',
  text: '#388e3c',
  boolean: '#f57c00',
}

function FeatureCard({ col }: { col: FeaturePreviewItem }) {
  const color = TYPE_COLORS[col.type] ?? '#757575'
  const flags: string[] = []
  if (col.missing_pct > 20) flags.push(`Missing: ${col.missing_pct}%`)
  if (col.skewed) flags.push('Skewed')
  if (col.outliers_likely) flags.push('Outliers')
  if (col.is_constant) flags.push('Constant')
  if (col.is_id_like) flags.push('ID-like')
  if (col.is_datetime) flags.push('Time-based')

  return (
    <Box sx={{
      p: 1.25, border: '1px solid', borderColor: col.is_constant || col.is_id_like ? 'warning.main' : 'divider',
      borderRadius: 1.5, height: '100%',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography variant="caption" fontWeight={700} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {col.name}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {col.type} · {col.unique_count.toLocaleString()} unique
      </Typography>
      {col.missing_pct > 0 && (
        <Typography variant="caption" color={col.missing_pct > 20 ? 'error' : 'text.secondary'} sx={{ display: 'block' }}>
          Missing: {col.missing_pct}%
        </Typography>
      )}
      {col.min != null && col.max != null && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
          {col.min?.toFixed(1)} – {col.max?.toFixed(1)}
        </Typography>
      )}
      {col.top_values && col.top_values.length > 0 && (
        <Tooltip title={col.top_values.join(', ')}>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>
            {col.top_values.slice(0, 3).join(', ')}…
          </Typography>
        </Tooltip>
      )}
      {flags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.5 }}>
          {flags.map(f => (
            <Box key={f} sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: 'warning.light', color: 'warning.dark', fontSize: '0.6rem', fontWeight: 600 }}>
              {f}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

interface Props {
  features: FeaturePreviewItem[]
}

export default function FeaturePreviewGrid({ features }: Props) {
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        🔍 Feature Preview
      </Typography>
      <Grid container spacing={1}>
        {features.map(col => (
          <Grid key={col.name} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <FeatureCard col={col} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
