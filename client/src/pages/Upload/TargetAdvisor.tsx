import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import StarIcon from '@mui/icons-material/Star'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { TargetCandidate } from '../../api/types'

interface Props {
  candidates: TargetCandidate[]
  selectedTarget: string
  onSelect: (col: string, task: string) => void
}

export default function TargetAdvisor({ candidates, selectedTarget, onSelect }: Props) {
  const top5 = candidates.slice(0, 5)

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        🎯 Target Column Advisor
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Columns ranked by suitability as a prediction target. Click to select.
      </Typography>

      <Stack spacing={1}>
        {top5.map((c) => {
          const isSelected = c.name === selectedTarget
          const hasWarnings = c.warnings.length > 0
          const borderColor = isSelected ? 'primary.main' : hasWarnings ? 'warning.main' : 'divider'
          const bgColor = isSelected ? 'rgba(25,118,210,0.06)' : 'background.paper'

          return (
            <Box
              key={c.name}
              onClick={() => !hasWarnings && onSelect(c.name, c.inferred_task)}
              sx={{
                p: 1.5, border: '1px solid', borderColor, borderRadius: 1.5, bgcolor: bgColor,
                cursor: hasWarnings ? 'default' : 'pointer',
                transition: 'all 0.15s',
                '&:hover': !hasWarnings ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {c.is_recommended && <StarIcon sx={{ color: '#ffc107', fontSize: 18 }} />}
                <Typography variant="body2" fontWeight={c.is_recommended ? 700 : 500}>
                  {c.name}
                </Typography>
                <Chip
                  label={c.inferred_task}
                  size="small"
                  color={isSelected ? 'primary' : 'default'}
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 18 }}
                />
                <Box sx={{ flex: 1 }} />
                {/* Score bar */}
                <Tooltip title={`Suitability score: ${(c.score * 100).toFixed(0)}%`}>
                  <Box sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: 'divider', overflow: 'hidden' }}>
                    <Box sx={{
                      width: `${c.score * 100}%`, height: '100%', borderRadius: 3,
                      bgcolor: c.score > 0.6 ? '#4caf50' : c.score > 0.3 ? '#ff9800' : '#f44336',
                    }} />
                  </Box>
                </Tooltip>
              </Box>

              {c.reasons.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: c.warnings.length ? 0.5 : 0 }}>
                  {c.reasons.map((r, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 11, color: '#4caf50' }} />
                      <Typography variant="caption" color="text.secondary">{r}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}

              {c.warnings.map((w, i) => (
                <Alert
                  key={i}
                  severity="warning"
                  icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                  sx={{ py: 0, px: 1, mt: 0.5, fontSize: '0.72rem', '& .MuiAlert-message': { py: 0.25 } }}
                >
                  {w}
                </Alert>
              ))}
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
