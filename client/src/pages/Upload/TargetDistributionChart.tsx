import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { TargetDistribution } from '../../api/types'

interface Props {
  dist: TargetDistribution
}

function ClassBar({ label, pct, count }: { label: string; pct: number; count: number }) {
  const color = pct < 15 ? '#f44336' : pct < 30 ? '#ff9800' : '#4caf50'
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {pct.toFixed(1)}% ({count.toLocaleString()})
        </Typography>
      </Box>
      <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ width: `${Math.min(pct, 100)}%`, height: '100%', bgcolor: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </Box>
    </Box>
  )
}

export default function TargetDistributionChart({ dist }: Props) {
  if (dist.type === 'classification') {
    const classes = dist.classes ?? []
    const imbalanceColor = dist.imbalance === 'severe' ? '#f44336' : dist.imbalance === 'moderate' ? '#ff9800' : '#4caf50'
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>📉 Target Distribution</Typography>
          {dist.imbalance && dist.imbalance !== 'none' && (
            <Tooltip title={`Minority class: ${dist.minority_pct?.toFixed(1)}%`}>
              <Box sx={{ px: 1, py: 0.15, borderRadius: 10, bgcolor: `${imbalanceColor}18`, color: imbalanceColor, fontSize: '0.65rem', fontWeight: 700, border: `1px solid ${imbalanceColor}40`, cursor: 'help' }}>
                {dist.imbalance} imbalance
              </Box>
            </Tooltip>
          )}
        </Box>
        <Box>
          {classes.slice(0, 10).map(c => (
            <ClassBar key={c.label} label={c.label} pct={c.pct} count={c.count} />
          ))}
          {classes.length > 10 && (
            <Typography variant="caption" color="text.disabled">…and {classes.length - 10} more classes</Typography>
          )}
        </Box>
        {dist.missing_pct > 0 && (
          <Typography variant="caption" color="text.secondary">Missing: {dist.missing_pct.toFixed(1)}%</Typography>
        )}
      </Box>
    )
  }

  // Regression
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>📉 Target Distribution</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {[
          { label: 'Mean', value: dist.mean?.toFixed(2) },
          { label: 'Std', value: dist.std?.toFixed(2) },
          { label: 'Min', value: dist.min?.toFixed(2) },
          { label: 'Max', value: dist.max?.toFixed(2) },
          { label: 'Skew', value: dist.skewness?.toFixed(2) },
        ].filter(s => s.value != null).map(s => (
          <Box key={s.label} sx={{ px: 1.5, py: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
            <Typography variant="body2" fontWeight={700}>{s.value}</Typography>
          </Box>
        ))}
      </Box>
      {dist.outliers_likely && (
        <Typography variant="caption" color="warning.main">⚠ Outliers likely (high skew)</Typography>
      )}
      {/* Mini histogram */}
      {(dist.histogram ?? []).length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 40, mt: 1 }}>
          {(dist.histogram ?? []).map((h, i) => {
            const maxCount = Math.max(...(dist.histogram ?? []).map(x => x.count))
            const heightPct = (h.count / maxCount) * 100
            return (
              <Tooltip key={i} title={`${h.bin}: ${h.count}`}>
                <Box sx={{ flex: 1, height: `${heightPct}%`, bgcolor: 'primary.main', opacity: 0.7, borderRadius: '2px 2px 0 0', minHeight: 2 }} />
              </Tooltip>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
