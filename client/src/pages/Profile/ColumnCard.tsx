import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import type { ColumnProfile, FeatureQualityScore } from '../../api/types'

interface ColumnCardProps {
  col: ColumnProfile
  qualityScore?: FeatureQualityScore
}

const typeColors: Record<string, string> = {
  numeric: '#6C63FF',
  categorical: '#FF6584',
  datetime: '#4CAF50',
  text: '#FFA726',
  boolean: '#26C6DA',
}

const GRADE_COLORS: Record<string, string> = {
  Good: '#4caf50',
  Review: '#ff9800',
  Problematic: '#f44336',
}

export default function ColumnCard({ col, qualityScore }: ColumnCardProps) {
  const hasHistogram = col.histogram && col.histogram.length > 0
  const gradeColor = qualityScore ? GRADE_COLORS[qualityScore.grade] : undefined

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: col.is_target ? 'primary.main' : gradeColor ? `${gradeColor}40` : 'divider',
        borderRadius: 2,
        position: 'relative',
        height: '100%',
      }}
    >
      {/* Quality score badge */}
      {qualityScore && !col.is_target && (
        <Tooltip title={qualityScore.issues.length ? qualityScore.issues.join(' · ') : 'No issues detected'}>
          <Box sx={{
            position: 'absolute', top: 8, left: 8, width: 8, height: 8,
            borderRadius: '50%', bgcolor: gradeColor, cursor: 'help',
          }} />
        </Tooltip>
      )}
      {col.is_target && (
        <Chip label="TARGET" color="primary" size="small" sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 800, fontSize: '0.65rem' }} />
      )}

      {/* Column name & type */}
      <Box sx={{ mb: 1, pr: col.is_target ? 7 : 0, pl: qualityScore && !col.is_target ? 1.5 : 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', mb: 0.25 }}>{col.name}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label={col.inferred_type} size="small" sx={{ bgcolor: typeColors[col.inferred_type], color: 'white', fontWeight: 600, fontSize: '0.65rem' }} />
          <Chip label={col.dtype} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
        </Box>
      </Box>

      {/* Missing */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
          <Typography variant="caption" color="text.secondary">Missing</Typography>
          <Typography variant="caption" color={col.missing_pct > 0.2 ? 'error.main' : col.missing_pct > 0.05 ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>
            {(col.missing_pct * 100).toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={col.missing_pct * 100}
          color={col.missing_pct > 0.2 ? 'error' : col.missing_pct > 0.05 ? 'warning' : 'success'}
          sx={{ height: 3, borderRadius: 2 }}
        />
      </Box>

      {/* Stats */}
      {col.inferred_type === 'numeric' && col.mean !== undefined && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mb: 1 }}>
          {[
            ['Mean', col.mean?.toFixed(2)],
            ['Std', col.std?.toFixed(2)],
            ['Min', col.min?.toFixed(0)],
            ['Max', col.max?.toFixed(0)],
          ].map(([k, v]) => (
            <Box key={k}>
              <Typography variant="caption" color="text.disabled">{k}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, ml: 0.5 }}>{v}</Typography>
            </Box>
          ))}
          {col.skewness !== undefined && (
            <Tooltip title="Skewness: >1 or <-1 means highly skewed">
              <Chip
                label={`Skew: ${col.skewness.toFixed(2)}`}
                size="small"
                color={Math.abs(col.skewness) > 1 ? 'warning' : 'default'}
                sx={{ fontSize: '0.65rem', mt: 0.5 }}
              />
            </Tooltip>
          )}
          {qualityScore?.issues.map(issue => (
            <Chip key={issue} label={issue} size="small" color="warning" sx={{ fontSize: '0.6rem', mt: 0.5, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} />
          ))}
        </Box>
      )}

      {col.inferred_type === 'categorical' && col.top_values && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Top values</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 0.25 }}>
            {col.top_values.slice(0, 3).map((tv) => (
              <Chip key={String(tv.value)} label={`${tv.value} (${tv.count.toLocaleString()})`} size="small" variant="outlined" sx={{ fontSize: '0.6rem' }} />
            ))}
          </Box>
        </Box>
      )}

      {/* Mini histogram */}
      {hasHistogram && (
        <Box sx={{ height: 50, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={col.histogram} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <XAxis dataKey="bin" tick={false} />
              <YAxis tick={false} />
              <RTooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Count']} labelFormatter={(l) => `Bin: ${l}`} />
              <Bar dataKey="count" fill={typeColors[col.inferred_type] ?? '#6C63FF'} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* Warnings */}
      {col.warnings?.map((w) => (
        <Chip key={w} label={w} size="small" color="warning" sx={{ mt: 0.5, fontSize: '0.6rem', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} />
      ))}
    </Box>
  )
}
