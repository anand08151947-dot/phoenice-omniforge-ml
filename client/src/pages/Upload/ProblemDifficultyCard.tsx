import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { ProblemDifficulty, ImbalanceSeverity } from '../../api/types'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4caf50',
  Medium: '#ff9800',
  Hard: '#f44336',
}

interface Props {
  difficulty: ProblemDifficulty
  imbalance: ImbalanceSeverity
}

export default function ProblemDifficultyCard({ difficulty, imbalance }: Props) {
  const color = DIFFICULTY_COLORS[difficulty.level] ?? '#757575'
  const hasImbalance = imbalance.severity !== 'n/a' && imbalance.severity !== 'none'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Difficulty */}
      <Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>🧠 Problem Difficulty</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box sx={{
            px: 2, py: 0.5, borderRadius: 10, bgcolor: `${color}18`, color,
            border: `1px solid ${color}40`, fontWeight: 700, fontSize: '0.85rem',
          }}>
            {difficulty.level}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Estimated baseline: ~{difficulty.baseline_accuracy}%
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {difficulty.reasons.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 12, color: '#9e9e9e' }} />
              <Typography variant="caption" color="text.secondary">{r}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Imbalance + metric */}
      {hasImbalance && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>⚖️ Imbalance Severity</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={`${imbalance.severity} (${imbalance.minority_pct?.toFixed(1)}% minority)`}
              size="small"
              color={imbalance.severity === 'severe' ? 'error' : imbalance.severity === 'moderate' ? 'warning' : 'default'}
            />
          </Box>
          {imbalance.techniques.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">Suggested:</Typography>
              {imbalance.techniques.map(t => (
                <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 11, color: '#4caf50' }} />
                  <Typography variant="caption">{t}</Typography>
                </Box>
              ))}
            </Box>
          )}
          {imbalance.recommended_metric && (
            <Tooltip title={imbalance.metric_reason}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, border: '1px solid', borderColor: 'primary.main', borderRadius: 1, cursor: 'help' }}>
                <Typography variant="caption" color="primary" fontWeight={700}>
                  🏗️ Primary metric: {imbalance.recommended_metric}
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  )
}
